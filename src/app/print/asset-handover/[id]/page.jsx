'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import axiosInstance from '@/utils/axios';
import HandoverFormView from '../../../HRM/Asset/components/HandoverFormView';

function AssetHandoverPrintContent() {
    const params = useParams();
    const searchParams = useSearchParams();
    const id = params.id;
    const historyId = searchParams.get('historyId');

    const [asset, setAsset] = useState(null);
    const [history, setHistory] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAsset = async () => {
            try {
                if (historyId) {
                    const historyRes = await axiosInstance.get(`/AssetItem/history-record/${historyId}`);
                    setHistory(historyRes.data);
                    setAsset(historyRes.data.details); // The snapshot is in details
                } else {
                    const response = await axiosInstance.get(`/AssetItem/detail/${id}`);
                    setAsset(response.data);
                }
            } catch (error) {
                console.error('Error fetching asset for print:', error);
            } finally {
                setLoading(false);
            }
        };

        if (id || historyId) fetchAsset();
    }, [id, historyId]);

    if (loading) return <div className="p-8 text-center text-gray-500">Loading document...</div>;
    if (!asset) return <div className="p-8 text-center text-red-500">Asset not found</div>;

    return (
        <div id="asset-handover-container" className="bg-white">
            <HandoverFormView
                asset={asset}
                isPrint={true}
                overrideDate={history ? history.date : null}
            />
        </div>
    );
}

export default function AssetHandoverPrintPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center">Loading context...</div>}>
            <AssetHandoverPrintContent />
        </Suspense>
    );
}
