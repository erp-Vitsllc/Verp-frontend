'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation'; // Import useRouter
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import axiosInstance from '@/utils/axios';
import AddLoanModal from './components/AddLoanModal';

export default function LoanPage() {
    const router = useRouter(); // Initialize router
    const [mounted, setMounted] = useState(false);
    const [loans, setLoans] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('Loan'); // 'Loan' or 'Advance'

    useEffect(() => {
        setMounted(true);
        fetchEmployees();
        fetchLoans();
    }, []);

    const fetchEmployees = async () => {
        try {
            const response = await axiosInstance.get('/Employee/loan-eligible');
            setEmployees(response.data.employees || []);
        } catch (error) {
            console.error('Error fetching employees:', error);
        }
    };

    const fetchLoans = async () => {
        try {
            const response = await axiosInstance.get('/Employee/loans');
            setLoans(response.data.loans || []);
        } catch (error) {
            console.error('Error fetching loans:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddLoan = () => {
        setShowAddModal(true);
    };

    const handleModalSuccess = () => {
        fetchLoans();
    };

    if (!mounted) {
        return null;
    }

    const filteredData = loans.filter(item => item.type === activeTab);

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

                        {/* Tabs */}
                        <div className="flex gap-4 mb-6">
                            <button
                                onClick={() => setActiveTab('Loan')}
                                className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'Loan'
                                    ? 'bg-blue-600 text-white shadow-md'
                                    : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-100'
                                    }`}
                            >
                                Loan List
                            </button>
                            <button
                                onClick={() => setActiveTab('Advance')}
                                className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'Advance'
                                    ? 'bg-teal-600 text-white shadow-md'
                                    : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-100'
                                    }`}
                            >
                                Salary Advance List
                            </button>
                        </div>

                        {/* Table */}
                        <div className="bg-white rounded-lg shadow-sm overflow-hidden w-full max-w-full">
                            <div className="overflow-x-auto w-full max-w-full">
                                <table className="w-full min-w-0 table-auto">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                {activeTab === 'Advance' ? 'Salary Advance' : activeTab} ID
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                Emp ID
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                User Name
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                {activeTab === 'Advance' ? 'Salary Advance' : activeTab} Amount
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                {activeTab === 'Advance' ? 'Salary Advance' : activeTab} Status
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                Application Status
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {loading ? (
                                            <tr>
                                                <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                                                    Loading...
                                                </td>
                                            </tr>
                                        ) : filteredData.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                                                    No {activeTab === 'Advance' ? 'salary advance' : activeTab.toLowerCase()}s found.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredData.map((item) => (
                                                <tr
                                                    key={item.id}
                                                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                                                    onClick={() => {
                                                        const typeSlug = item.type ? item.type.replace(/\s+/g, '-') : 'Loan';
                                                        router.push(`/HRM/LoanAndAdvance/${typeSlug}-${item.id}`);
                                                    }}
                                                >
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                        {item.loanId ? item.loanId.toUpperCase() : item.id.substring(item.id.length - 6).toUpperCase()}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                        {item.employeeId}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                                                        {item.employeeName}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-semibold">
                                                        AED {Number(item.amount).toLocaleString()}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span
                                                            className={`px-3 py-1 rounded-full text-xs font-medium ${item.activeStatus === 'Open'
                                                                ? 'bg-green-100 text-green-800'
                                                                : 'bg-gray-100 text-gray-700'
                                                                }`}
                                                        >
                                                            {item.activeStatus || 'Open'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span
                                                            className={`px-3 py-1 rounded-full text-xs font-medium ${item.applicationStatus === 'Approved'
                                                                ? 'bg-blue-100 text-blue-800'
                                                                : item.applicationStatus === 'Pending'
                                                                    ? 'bg-yellow-100 text-yellow-800'
                                                                    : 'bg-red-100 text-red-800'
                                                                }`}
                                                        >
                                                            {item.applicationStatus || 'Pending'}
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
