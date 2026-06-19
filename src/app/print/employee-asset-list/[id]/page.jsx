'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import axiosInstance from '@/utils/axios';
import AssetListFormView from '@/app/emp/[employeeId]/components/AssetListFormView';

function EmployeeAssetListPrintContent() {
    const params = useParams();
    const id = params.id;

    const [employee, setEmployee] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchEmployee = async () => {
            try {
                const response = await axiosInstance.get(`/Employee/${id}`);
                setEmployee(response.data);
            } catch (error) {
                console.error('Error fetching employee for asset list print:', error);
            } finally {
                setLoading(false);
            }
        };

        if (id) fetchEmployee();
    }, [id]);

    const listReady = !loading && !!employee;

    return (
        <div
            id="employee-asset-list-container"
            className="bg-white min-h-[120px]"
            data-asset-list-ready={listReady ? 'true' : 'false'}
        >
            {loading && (
                <div className="p-8 text-center text-gray-500">Loading document...</div>
            )}
            {!loading && !employee && (
                <div className="p-8 text-center text-red-500">Employee not found</div>
            )}
            {!loading && employee && (
                <AssetListFormView
                    employee={employee}
                    assets={employee.assets || []}
                    isPrint={true}
                />
            )}
        </div>
    );
}

export default function EmployeeAssetListPrintPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center">Loading context...</div>}>
            <EmployeeAssetListPrintContent />
        </Suspense>
    );
}
