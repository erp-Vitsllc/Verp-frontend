'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import axiosInstance from '@/utils/axios';
import AddLoanModal from './components/AddLoanModal';

export default function LoanPage() {
    const [mounted, setMounted] = useState(false);
    const [loans, setLoans] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setMounted(true);
        fetchEmployees();
    }, []);

    const fetchEmployees = async () => {
        try {
            // Using the new endpoint for eligible employees
            const response = await axiosInstance.get('/Employee/loan-eligible');
            setEmployees(response.data.employees || []);
        } catch (error) {
            console.error('Error fetching employees:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddLoan = () => {
        setShowAddModal(true);
    };

    const handleModalSuccess = () => {
        // Refresh loans list (implementation pending for fetchLoans)
        // fetchLoans();
    };

    if (!mounted) {
        return null; // Prevent hydration mismatch
    }

    return (
        <PermissionGuard moduleId="hrm_loan" permissionType="view">
            <div className="flex min-h-screen w-full max-w-full overflow-x-hidden" style={{ backgroundColor: '#F2F6F9' }}>
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
                    <Navbar />
                    <div className="p-8 w-full max-w-full overflow-x-hidden" style={{ backgroundColor: '#F2F6F9' }}>

                        {/* Header and Actions */}
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h1 className="text-3xl font-bold text-gray-800 mb-2">Loan and Advance Management</h1>
                                <p className="text-gray-600">
                                    Manage employee loans and advances
                                </p>
                            </div>

                            <button
                                onClick={handleAddLoan}
                                className="bg-teal-500 hover:bg-teal-600 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 5v14M5 12h14"></path>
                                </svg>
                                Add Loan/Advance
                            </button>
                        </div>

                        {/* Loan Table */}
                        <div className="bg-white rounded-lg shadow-sm overflow-hidden w-full max-w-full">
                            <div className="overflow-x-auto w-full max-w-full">
                                <table className="w-full min-w-0 table-auto">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                Loan ID
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                Emp ID
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                Loan Amount
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                Loan Status
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                Application Status
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {loans.length === 0 ? (
                                            <tr>
                                                <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                                                    No loans found.
                                                </td>
                                            </tr>
                                        ) : (
                                            loans.map((loan) => (
                                                <tr key={loan.id} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                        {loan.loanId}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                        {loan.employeeId}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-semibold">
                                                        {loan.loanAmount.toLocaleString()}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span
                                                            className={`px-3 py-1 rounded-full text-xs font-medium ${loan.loanStatus === 'Open'
                                                                ? 'bg-green-100 text-green-800'
                                                                : 'bg-gray-100 text-gray-700'
                                                                }`}
                                                        >
                                                            {loan.loanStatus}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span
                                                            className={`px-3 py-1 rounded-full text-xs font-medium ${loan.applicationStatus === 'Approved'
                                                                ? 'bg-blue-100 text-blue-800'
                                                                : loan.applicationStatus === 'Pending'
                                                                    ? 'bg-yellow-100 text-yellow-800'
                                                                    : 'bg-red-100 text-red-800'
                                                                }`}
                                                        >
                                                            {loan.applicationStatus}
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

            <AddLoanModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                onSuccess={handleModalSuccess}
                employees={employees}
            />
        </PermissionGuard>
    );
}
