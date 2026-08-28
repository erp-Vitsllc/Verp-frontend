'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import ErpPageHeader from '@/components/ErpPageHeader';
import ErpErrorBanner from '@/components/ErpErrorBanner';
import axiosInstance from '@/utils/axios';
import SalaryHeaderActions from '../components/SalaryHeaderActions';
import SalaryMonthControlCentre from '../components/SalaryMonthControlCentre';

export default function SalaryPaymentPage() {
    const [monthKey, setMonthKey] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const loadLatestMonth = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await axiosInstance.get('/Employee/salary-register', { skipToast: true });
            const list = Array.isArray(res.data?.months) ? res.data.months : [];
            const latest = String(list[0]?.monthKey || '').trim();
            setMonthKey(latest);
            if (!latest) setError('No salary month is available to process payment.');
        } catch (err) {
            setMonthKey('');
            setError(err?.response?.data?.message || 'Failed to load salary payment.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadLatestMonth();
    }, [loadLatestMonth]);

    return (
        <PermissionGuard
            moduleId="hrm_salary"
            moduleIds={['hrm_salary', 'hrm_employees_view_salary', 'hrm']}
            permissionType="view"
        >
            <div
                className="flex min-h-screen w-full max-w-full overflow-x-hidden"
                style={{ backgroundColor: monthKey ? '#f6f7f9' : '#F2F6F9' }}
            >
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
                    <Navbar />
                    <div
                        className="p-3 sm:p-5 lg:p-8 w-full max-w-full overflow-x-hidden"
                        style={{ backgroundColor: monthKey ? '#f6f7f9' : '#F2F6F9' }}
                    >
                        {loading ? (
                            <>
                                <ErpPageHeader title="Salary Payment">
                                    <SalaryHeaderActions enrollLabel="Salary Enrollment" />
                                </ErpPageHeader>
                                <div className="rounded-xl border border-gray-100 bg-white px-4 py-10 flex justify-center">
                                    <Loader2 size={22} className="animate-spin text-blue-600" />
                                </div>
                            </>
                        ) : error || !monthKey ? (
                            <>
                                <ErpPageHeader title="Salary Payment">
                                    <SalaryHeaderActions enrollLabel="Salary Enrollment" />
                                </ErpPageHeader>
                                <ErpErrorBanner className="mb-4" message={error} onRetry={loadLatestMonth} />
                            </>
                        ) : (
                            <>
                                <ErpPageHeader title="Salary Payment">
                                    <SalaryHeaderActions enrollLabel="Salary Enrollment" />
                                </ErpPageHeader>
                                <SalaryMonthControlCentre monthKey={monthKey} />
                            </>
                        )}
                    </div>
                </div>
            </div>
        </PermissionGuard>
    );
}
