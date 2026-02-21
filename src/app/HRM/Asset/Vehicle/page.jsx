'use client';

import { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { Search, RotateCcw, Truck, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import AddVehicleModal from '@/app/HRM/Asset/Vehicle/components/AddVehicleModal';
import { Plus } from 'lucide-react';

export default function VehicleAssetPage() {
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const { toast } = useToast();
    const [isAddVehicleModalOpen, setIsAddVehicleModalOpen] = useState(false);
    const [employees, setEmployees] = useState([]);

    useEffect(() => {
        setMounted(true);
        fetchVehicles();
        fetchEmployees();
    }, []);

    const fetchVehicles = useCallback(async () => {
        try {
            setLoading(true);
            const response = await axiosInstance.get('/AssetType');
            const allAssets = response.data || [];

            const vehicleAssets = allAssets.filter(asset => {
                const isIndividualAsset = asset.assetId?.startsWith('VEGA-ASSET-');
                if (!isIndividualAsset) return false;

                const typeLower = asset.type?.toLowerCase() || '';
                return typeLower.includes('vehicle') || typeLower.includes('car') || (asset.plateNumber && asset.plateNumber.trim() !== '');
            });

            setVehicles(vehicleAssets);
        } catch (error) {
            console.error("Error fetching vehicles", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to fetch vehicle assets."
            });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    const fetchEmployees = async () => {
        try {
            const response = await axiosInstance.get('/employee');
            setEmployees(response.data.employees || response.data || []);
        } catch (error) {
            console.error("Error fetching employees", error);
        }
    };

    if (!mounted) return null;

    return (
        <PermissionGuard moduleId="hrm_asset" redirectTo="/dashboard">
            <div className="flex min-h-screen w-full bg-[#f2f6f9]">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0">
                    <Navbar />
                    <div className="p-8">

                        {/* Header */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <h1 className="text-2xl font-bold text-gray-800">Vehicle Assets</h1>
                                    <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                                        {vehicles.length}
                                    </span>
                                </div>
                                <p className="text-gray-500 text-sm">Manage company fleet and transport assets</p>
                            </div>

                            <div className="flex items-center gap-3">
                                {/* Search */}
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Search vehicles..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-64 shadow-sm"
                                    />
                                </div>

                                <button
                                    onClick={fetchVehicles}
                                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-gray-200 bg-white shadow-sm"
                                    title="Refresh List"
                                >
                                    <RotateCcw size={18} />
                                </button>
                                <button
                                    onClick={() => setIsAddVehicleModalOpen(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors shadow-sm ml-2"
                                >
                                    <Plus size={18} />
                                    <span className="text-sm font-medium">Add Vehicle</span>
                                </button>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50/50 border-b border-gray-100 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                                            <th className="px-6 py-4">Vehicle Code</th>
                                            <th className="px-6 py-4">Plate No</th>
                                            <th className="px-6 py-4">Model Year</th>
                                            <th className="px-6 py-4">Current Km</th>

                                            <th className="px-6 py-4">Assigned To</th>
                                            <th className="px-6 py-4">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {loading ? (
                                            <tr>
                                                <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                                                    <div className="flex flex-col items-center gap-2">
                                                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                                        <p className="text-sm">Loading vehicles...</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : vehicles.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                                                    <div className="flex flex-col items-center gap-3">
                                                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                                                            <Truck size={24} />
                                                        </div>
                                                        <p className="font-medium">No vehicles found</p>
                                                        <p className="text-xs text-gray-400">Add assets with type "Vehicle" to see them here.</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            vehicles
                                                .filter(v =>
                                                    !searchQuery ||
                                                    v.vehicleCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                    v.plateNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                    v.assetId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                    (v.assignedTo?.firstName?.toLowerCase() || '').includes(searchQuery.toLowerCase())
                                                )
                                                .map((vehicle) => (
                                                    <tr
                                                        key={vehicle._id}
                                                        className="hover:bg-blue-50/30 transition-colors group cursor-pointer"
                                                        onClick={() => router.push(`/HRM/Asset/Vehicle/details/${vehicle._id}`)}
                                                    >
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col">
                                                                <span className="font-semibold text-gray-800 text-sm">
                                                                    {vehicle.vehicleCode || vehicle.assetId || '-'}
                                                                </span>
                                                                {vehicle.vehicleCode && vehicle.assetId !== vehicle.vehicleCode && (
                                                                    <span className="text-xs text-gray-400">{vehicle.assetId}</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-sm font-medium text-gray-700">
                                                            {vehicle.plateNumber ? (
                                                                <span className="px-2 py-1 bg-gray-100 rounded border border-gray-200 font-mono text-gray-600">
                                                                    {vehicle.plateNumber}
                                                                </span>
                                                            ) : (
                                                                <span className="text-gray-400">-</span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-gray-600">
                                                            {vehicle.modelYear || '-'}
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-gray-600 font-mono">
                                                            {vehicle.currentKilometer ? `${vehicle.currentKilometer.toLocaleString()} km` : '-'}
                                                        </td>

                                                        <td className="px-6 py-4 text-sm text-gray-600">
                                                            {vehicle.assignedTo ? (
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold">
                                                                        {vehicle.assignedTo.firstName?.[0]}{vehicle.assignedTo.lastName?.[0]}
                                                                    </div>
                                                                    <span>{vehicle.assignedTo.firstName} {vehicle.assignedTo.lastName}</span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-gray-400 italic">Unassigned</span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${vehicle.status === 'Assigned'
                                                                ? 'bg-blue-50 text-blue-700 border-blue-100'
                                                                : vehicle.status === 'Service'
                                                                    ? 'bg-rose-50 text-rose-700 border-rose-100'
                                                                    : vehicle.status === 'Pending'
                                                                        ? 'bg-amber-50 text-amber-700 border-amber-100'
                                                                        : 'bg-green-50 text-green-700 border-green-100'
                                                                }`}>
                                                                {vehicle.status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {isAddVehicleModalOpen && (
                <AddVehicleModal
                    isOpen={isAddVehicleModalOpen}
                    onClose={() => setIsAddVehicleModalOpen(false)}
                    onSuccess={() => {
                        fetchVehicles();
                        toast({ title: "Success", description: "Vehicle added successfully." });
                    }}
                />
            )}
        </PermissionGuard>
    );
}
