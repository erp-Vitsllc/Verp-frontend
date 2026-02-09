'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import axiosInstance from '@/utils/axios';
import { Plus, MoreVertical, Search, ArrowLeft } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { sanitizeUrl } from '@/utils/security';
import AddAssetItemModal from './components/AddAssetItemModal';

export default function AssetItemsPage() {
    const router = useRouter();
    const params = useParams();
    const [assetType, setAssetType] = useState(null);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchData = async () => {
        try {
            setLoading(true);
            const [typeRes, itemsRes] = await Promise.all([
                axiosInstance.get(`/AssetType/${params.id}`),
                axiosInstance.get(`/AssetItem/${params.id}`)
            ]);
            setAssetType(typeRes.data);
            setItems(itemsRes.data);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (params.id) {
            fetchData();
        }
    }, [params.id]);

    const handleSearch = (e) => {
        setSearchQuery(e.target.value);
    };

    const filteredItems = items.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.assetId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.assignedTo && (item.assignedTo.firstName + ' ' + item.assignedTo.lastName).toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="flex min-h-screen w-full max-w-full overflow-x-hidden" style={{ backgroundColor: '#F2F6F9' }}>
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
                <Navbar />
                <div className="p-8 w-full max-w-full overflow-x-hidden" style={{ backgroundColor: '#F2F6F9' }}>

                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => router.back()}
                                className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                            >
                                <ArrowLeft size={20} className="text-gray-600" />
                            </button>
                            <div>
                                <h1 className="text-3xl font-bold text-gray-800 mb-1">
                                    {loading ? 'Loading...' : assetType?.type}
                                </h1>
                                <p className="text-gray-600">
                                    {items.length} Items
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            {/* Search */}
                            <div className="relative flex-1 max-w-md w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Search items..."
                                    value={searchQuery}
                                    onChange={handleSearch}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-800/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                                />
                            </div>

                            <button
                                onClick={() => setIsAddModalOpen(true)}
                                className="bg-teal-500 hover:bg-teal-600 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm"
                            >
                                <Plus size={18} />
                                <span>Add Item</span>
                            </button>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-lg shadow-sm overflow-hidden w-full max-w-full">
                        <div className="overflow-x-auto w-full max-w-full">
                            <table className="w-full min-w-0 table-auto">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                            SL NO
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                            ASSET ID
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                            NAME
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                            ASSIGNED
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                            UNASSIGNED
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                            ACTIONS
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {loading ? (
                                        <tr>
                                            <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                                                Loading items...
                                            </td>
                                        </tr>
                                    ) : filteredItems.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                                                No items found. Add a new item to get started.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredItems.map((item, index) => (
                                            <tr
                                                key={item._id}
                                                className="hover:bg-gray-50 transition-colors cursor-pointer"
                                                onClick={() => router.push(`/HRM/Asset/details/${item._id}`)}
                                            >
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                    {index + 1}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-mono font-medium hover:underline">
                                                    {item.assetId}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-3">
                                                        {item.photo || item.imagePreview ? (
                                                            <img src={sanitizeUrl(item.photo || item.imagePreview, false)} alt={item.name} className="w-8 h-8 rounded-full object-cover bg-gray-100" />
                                                        ) : (
                                                            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 font-bold text-xs">
                                                                {item.name.substring(0, 2).toUpperCase()}
                                                            </div>
                                                        )}
                                                        <span className="font-medium text-gray-900">{item.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                    {item.assignedTo ? (
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xs font-bold">
                                                                {item.assignedTo.firstName[0]}
                                                            </div>
                                                            <span className="text-gray-700">
                                                                {item.assignedTo.firstName} {item.assignedTo.lastName}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-400 italic">-</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                    {!item.assignedTo ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                            Available
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-400">-</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <button className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                                                        <MoreVertical size={16} />
                                                    </button>
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

            <AddAssetItemModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSuccess={fetchData}
                assetTypeId={params.id}
            />
        </div>
    );
}
