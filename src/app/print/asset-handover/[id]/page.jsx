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

    // Keep #asset-handover-container in the DOM at all times so server-side PDF (Puppeteer) can wait
    // for data-handover-ready="true" after the API returns — not while loading or on error-only trees.
    const handoverReady = !loading && !!asset;

    return (
        <div
            id="asset-handover-container"
            className="bg-white min-h-[120px]"
            data-handover-ready={handoverReady ? 'true' : 'false'}
        >
            {loading && (
                <div className="p-8 text-center text-gray-500">Loading document...</div>
            )}
            {!loading && !asset && (
                <div className="p-8 text-center text-red-500">Asset not found</div>
            )}
            {!loading && asset && (
                <HandoverFormView
                    asset={asset}
                    isPrint={true}
                    overrideDate={history ? history.date : null}
                />
            )}
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
