'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import axiosInstance from '@/utils/axios';
import FineFlowManager from './components/FineFlowManager';

export default function FinePage() {
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [fines, setFines] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showAddFlow, setShowAddFlow] = useState(false);

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFineType, setSelectedFineType] = useState('');
    const fetchingRef = useRef(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Fetch employees for dropdown in modal
    const fetchEmployees = useCallback(async () => {
        try {
            const response = await axiosInstance.get('/Employee');
            setEmployees(response.data.employees || []);
        } catch (err) {
            console.error('Error fetching employees:', err);
        }
    }, []);

    // Fetch fines from backend
    const fetchFines = useCallback(async () => {
        if (fetchingRef.current) {
            return;
        }

        try {
            fetchingRef.current = true;
            setLoading(true);
            setError('');

            // Fetch with high limit to support client-side filtering
            // ideally this should be moved to server-side filtering in the future
            const response = await axiosInstance.get('/Fine?limit=1000');
            const finesData = response.data.fines || response.data || [];

            const validFines = finesData
                .filter(fine =>
                    fine != null &&
                    typeof fine === 'object' &&
                    (fine.fineId || fine._id)
                )
                .flatMap(fine => {
                    // Check if this is a Bulk/Group Fine stored as a single document
                    if (fine.assignedEmployees && fine.assignedEmployees.length > 0) {
                        const count = fine.assignedEmployees.length;
                        // Calculate share based on EMPLOYEE Liability, not Total Value
                        const totalEmpLiability = fine.employeeAmount || 0;
                        const shareAmount = count > 0 ? (totalEmpLiability / count) : 0;

                        return fine.assignedEmployees.map(emp => ({
                            ...fine,
                            // Override primary details with individual employee details
                            employeeId: emp.employeeId,
                            employeeName: emp.employeeName,
                            fineStatus: fine.fineStatus || 'Pending',
                            fineType: fine.fineType || 'Other',
                            displayAmount: shareAmount, // Show what THIS employee owes
                            category: fine.category || 'Other',
                            // Create a unique UI key since _id is shared
                            _uiKey: `${fine._id}_${emp.employeeId}`,
                            isGroupChild: true // Marker for UI if needed
                        }));
                    }

                    // Single Fine
                    return [{
                        ...fine,
                        fineStatus: fine.fineStatus || 'Pending',
                        employeeName: fine.employeeName || 'N/A',
                        fineType: fine.fineType || 'Other',
                        employeeId: fine.employeeId || 'N/A',
                        displayAmount: fine.employeeAmount || 0, // Show what employee owes
                        fineId: fine.fineId || fine._id?.slice(-8) || 'N/A',
                        category: fine.category || 'Other',
                        _uiKey: fine._id
                    }];
                });
            setFines(validFines);
        } catch (err) {
            console.error('Error fetching fines:', err);
            setError(err.response?.data?.message || err.message || 'Failed to fetch fines');
            setFines([]);
        } finally {
            setLoading(false);
            fetchingRef.current = false;
        }
    }, []);

    useEffect(() => {
        if (mounted) {
            fetchFines();
            fetchEmployees();
        }
    }, [mounted, fetchFines, fetchEmployees]);

    const handleAddFine = () => {
        setShowAddFlow(true);
    };

    const handleModalSuccess = () => {
        fetchFines();
    };

    const filteredFines = useMemo(() => {
        if (!fines || !Array.isArray(fines)) return [];

        let result = fines;

        // Filter by Fine Type or Category
        if (selectedFineType) {
            if (selectedFineType === 'Damage' || selectedFineType === 'Violation') {
                // If "Damage" or "Violation" is selected, filter by the generic Category
                // But wait, if the user selects "Damage" from the dropdown, they might mean generic "Damage" fineType 
                // OR the Category "Damage". The user request "under damage will show if i click damage" implies category.
                // However, there is also a "Damage" (Generic) FineType. 
                // Let's assume broad category filtering for these two main keywords.
                result = result.filter(fine => fine.category === selectedFineType || fine.fineType === selectedFineType);
            } else {
                // Specific Fine Types (e.g., 'Vehicle Fine', 'Project Damage')
                result = result.filter(fine => fine.fineType === selectedFineType);
            }
        }

        // Filter by Search Query
        const query = searchQuery.toLowerCase().trim();
        if (query) {
            result = result.filter(fine =>
                fine.fineId.toLowerCase().includes(query) ||
                fine.employeeId.toLowerCase().includes(query) ||
                fine.employeeName.toLowerCase().includes(query) ||
                fine.fineType.toLowerCase().includes(query) ||
                fine.fineStatus.toLowerCase().includes(query)
            );
        }

        return result;
    }, [fines, searchQuery, selectedFineType]);

    if (!mounted) {
        return null;
    }

    return (
        <PermissionGuard moduleId="hrm_fine" permissionType="view">
            <div className="flex min-h-screen w-full max-w-full overflow-x-hidden" style={{ backgroundColor: '#F2F6F9' }}>
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
                    <Navbar />
                    <div className="p-8 w-full max-w-full overflow-x-hidden" style={{ backgroundColor: '#F2F6F9' }}>
                        {/* Header and Actions */}
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h1 className="text-3xl font-bold text-gray-800 mb-2">Fine Management</h1>
                                <p className="text-gray-600">
                                    {filteredFines.filter(f => f.fineStatus === 'Active' || f.fineStatus === 'Approved').length} Active | {filteredFines.filter(f => f.fineStatus === 'Pending').length} Pending
                                </p>
                            </div>

                            <div className="flex items-center gap-4">
                                {/* Search */}
                                <div className="relative flex-1 min-w-[300px]">
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
                                        placeholder="Search Fines"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 border border-gray-800/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                                    />
                                </div>

                                {/* Fine Type Filter */}
                                <div className="relative min-w-[200px]">
                                    <select
                                        value={selectedFineType}
                                        onChange={(e) => setSelectedFineType(e.target.value)}
                                        className="w-full h-[38px] px-4 border border-gray-800/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white appearance-none cursor-pointer"
                                        style={{ backgroundImage: 'none' }} // Remove default arrow to style custom if needed, or keep standard
                                    >
                                        <option value="">All Fine Types</option>
                                        <option value="Vehicle Fine">Vehicle Fine</option>
                                        <option value="Safety Fine">Safety Fine</option>
                                        <option value="Violation">Violation</option>
                                        <option value="Project Damage">Project Damage</option>
                                        <option value="Loss & Damage">Loss & Damage</option>
                                        <option value="Other Damage">Other Damage</option>
                                        <option value="Damage">Damage</option>
                                        <option value="Other">Other</option>
                                    </select>
                                    {/* Custom Arrow */}
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="m6 9 6 6 6-6" />
                                        </svg>
                                    </div>
                                </div>

                                {/* Add Fine Button */}
                                <button
                                    onClick={handleAddFine}
                                    className="bg-teal-500 hover:bg-teal-600 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M12 5v14M5 12h14"></path>
                                    </svg>
                                    Add Fine
                                </button>
                            </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg p-4 mb-4">
                                {error}
                            </div>
                        )}

                        {/* Fines Table */}
                        <div className="bg-white rounded-lg shadow-sm overflow-hidden w-full max-w-full">
                            <div className="overflow-x-auto w-full max-w-full">
                                <table className="w-full min-w-0 table-auto">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                FINE ID
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                EMP. ID
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                NAME
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                FINE TYPE
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                AMOUNT
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                STATUS
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {loading ? (
                                            <tr>
                                                <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                                                    Loading fines...
                                                </td>
                                            </tr>
                                        ) : filteredFines.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                                                    No fines found. Click "Add Fine" to create one.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredFines.map((fine) => (
                                                <tr
                                                    key={fine._uiKey || fine._id || fine.fineId}
                                                    onClick={() => router.push(`/HRM/Fine/${fine.fineId}`)}
                                                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                                                >
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                        {fine.fineId}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                        {fine.employeeId}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                        {fine.employeeName}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                        {fine.fineType}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-semibold">
                                                        {Number(fine.displayAmount || 0).toLocaleString()}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span
                                                            className={`px-3 py-1 rounded-full text-xs font-medium ${fine.fineStatus === 'Active' || fine.fineStatus === 'Approved' || fine.fineStatus === 'Completed'
                                                                ? 'bg-green-100 text-green-800'
                                                                : fine.fineStatus === 'Pending'
                                                                    ? 'bg-yellow-100 text-yellow-800'
                                                                    : fine.fineStatus === 'Cancelled'
                                                                        ? 'bg-red-100 text-red-800'
                                                                        : 'bg-gray-100 text-gray-700'
                                                                }`}
                                                        >
                                                            {fine.fineStatus}
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

            <FineFlowManager
                isOpen={showAddFlow}
                onClose={() => setShowAddFlow(false)}
                onSuccess={handleModalSuccess}
                employees={employees}
            />
        </PermissionGuard>
    );
}
