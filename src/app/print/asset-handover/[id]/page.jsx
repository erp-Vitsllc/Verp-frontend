'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import axiosInstance from '@/utils/axios';
import HandoverFormView from '../../../HRM/Asset/components/HandoverFormView';

export default function AssetHandoverPrintPage() {
    const { id } = useParams();
    const [asset, setAsset] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAsset = async () => {
            try {
                const response = await axiosInstance.get(`/AssetItem/detail/${id}`);
                setAsset(response.data);
            } catch (error) {
                console.error('Error fetching asset for print:', error);
            } finally {
                setLoading(false);
            }
        };

        if (id) fetchAsset();
    }, [id]);

    if (loading) return <div className="p-8 text-center text-gray-500">Loading document...</div>;
    if (!asset) return <div className="p-8 text-center text-red-500">Asset not found</div>;

    return (
        <div id="asset-handover-container" className="bg-white">
            <HandoverFormView asset={asset} isPrint={true} />
        </div>
    );
}
