'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import axiosInstance from '@/utils/axios';
import FineFlowManager from './components/FineFlowManager';
import { Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
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

export default function FinePage() {
    const router = useRouter();
    const { toast } = useToast();
    const [mounted, setMounted] = useState(false);
    const [fines, setFines] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showAddFlow, setShowAddFlow] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [fineToDelete, setFineToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

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
                    const rows = [];
                    const baseFineId = fine.fineId || fine._id?.slice(-8) || 'N/A';

                    // 1. Employee Rows
                    if (fine.assignedEmployees && fine.assignedEmployees.length > 0) {
                        const count = fine.assignedEmployees.length;
                        const totalEmpLiability = fine.employeeAmount || 0;
                        const shareAmount = count > 0 ? (totalEmpLiability / count) : 0;

                        fine.assignedEmployees.forEach(emp => {
                            // Backend now stores Company as a separate 'User' fine record.
                            // We display it just like any other employee fine.

                            // Optional: Clean up Company ID for display
                            const dispEmpId = (emp.employeeId === 'VEGA_INTERNAL' || emp.employeeName === 'Vega Digital IT Solutions') ? null : emp.employeeId;

                            rows.push({
                                ...fine,
                                fineId: baseFineId,
                                employeeId: dispEmpId,
                                employeeName: emp.employeeName,
                                fineStatus: fine.fineStatus || 'Pending',
                                fineType: fine.fineType || 'Other',
                                displayAmount: shareAmount,
                                category: fine.category || 'Other',
                                _uiKey: `${fine._id}_${emp.employeeId}`,
                                isGroupChild: true
                            });
                        });
                    } else {
                        // Single Fine (Employee or Company-as-User)
                        const empName = fine.employeeName || 'N/A';

                        // Check if this is a Company Record (stored as user)
                        const isCompanyRec = empName === 'Vega Digital IT Solutions' || fine.employeeId === 'VEGA_INTERNAL';
                        const dispEmpId = isCompanyRec ? null : (fine.employeeId || 'N/A');

                        rows.push({
                            ...fine,
                            fineId: baseFineId,
                            fineStatus: fine.fineStatus || 'Pending',
                            employeeName: empName,
                            fineType: fine.fineType || 'Other',
                            employeeId: dispEmpId, // Hide ID for company
                            displayAmount: fine.employeeAmount || 0,
                            category: fine.category || 'Other',
                            _uiKey: fine._id
                        });
                    }

                    // 2. Suffix Calculation (For Group Fines Only)
                    if (rows.length > 1) {
                        rows.forEach((row, index) => {
                            const suffix = String.fromCharCode(65 + index); // 0->A, 1->B...
                            row.fineId = `${baseFineId}-${suffix}`;
                        });
                    }

                    return rows;
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

    const handleDeleteClick = (fine) => {
        setFineToDelete(fine);
        setIsDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!fineToDelete) return;

        try {
            setIsDeleting(true);
            await axiosInstance.delete(`/Fine/${fineToDelete._id}`);
            toast({
                title: "Success",
                description: "Fine record deleted successfully",
                variant: "success",
            });
            fetchFines();
        } catch (err) {
            console.error('Error deleting fine:', err);
            toast({
                title: "Error",
                description: err.response?.data?.message || "Failed to delete fine",
                variant: "destructive",
            });
        } finally {
            setIsDeleting(false);
            setIsDeleteDialogOpen(false);
            setFineToDelete(null);
        }
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
                        <div className="bg-white rounded-lg shadow-sm overflow-hidden w-full max-w-full border border-gray-200">
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
                                            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                ACTIONS
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {loading ? (
                                            <tr>
                                                <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                                                    Loading fines...
                                                </td>
                                            </tr>
                                        ) : filteredFines.length === 0 ? (
                                            <tr>
                                                <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                                                    No fines found. Click "Add Fine" to create one.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredFines.map((fine) => {
                                                const isCompanyRow = fine.isCompany || fine.employeeName === 'Vega Digital IT Solutions';
                                                return (
                                                    <tr
                                                        key={fine._uiKey || fine._id || fine.fineId}
                                                        onClick={() => !isCompanyRow && router.push(`/HRM/Fine/${fine.fineId}`)}
                                                        className={`transition-colors ${isCompanyRow ? 'cursor-default' : 'hover:bg-gray-50 cursor-pointer'}`}
                                                    >
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                            {fine.fineId}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                            {(fine.employeeId || '').replace(/\s+/g, '')}
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
                                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDeleteClick(fine);
                                                                    }}
                                                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                                    title="Delete Fine Transaction"
                                                                >
                                                                    <Trash2 size={18} />
                                                                </button>
                                                            </div>
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
                </div>
            </div>

            <FineFlowManager
                isOpen={showAddFlow}
                onClose={() => setShowAddFlow(false)}
                onSuccess={handleModalSuccess}
                employees={employees}
            />

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Fine Transaction?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this fine record? If this is a split fine, all associated employee/company entries for this transaction will be removed. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleDeleteConfirm();
                            }}
                            className="bg-red-600 hover:bg-red-700 text-white"
                            disabled={isDeleting}
                        >
                            {isDeleting ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </PermissionGuard>
    );
}
