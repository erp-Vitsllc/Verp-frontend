'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import axiosInstance from '@/utils/axios';
import VehicleHandoverFormView from '../../../HRM/Asset/Vehicle/components/VehicleHandoverFormView';

function VehicleHandoverPrintContent() {
    const params = useParams();
    const searchParams = useSearchParams();
    const vehicleId = params?.vehicleId;
    const historyId = searchParams.get('historyId');

    const [vehicle, setVehicle] = useState(null);
    const [historyEntry, setHistoryEntry] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            if (!vehicleId || !historyId) {
                setLoading(false);
                return;
            }

            try {
                const [vehicleRes, historyRes] = await Promise.all([
                    axiosInstance.get(`/AssetItem/detail/${vehicleId}`),
                    axiosInstance.get(`/AssetItem/history-record/${historyId}`),
                ]);
                if (cancelled) return;
                setVehicle(vehicleRes.data);
                setHistoryEntry(historyRes.data);
            } catch {
                if (!cancelled) {
                    setVehicle(null);
                    setHistoryEntry(null);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();
        return () => {
            cancelled = true;
        };
    }, [historyId, vehicleId]);

    const handoverReady = !loading && !!vehicle && !!historyEntry;

    return (
        <div
            id="vehicle-handover-print-root"
            className="bg-white min-h-[120px]"
            data-handover-ready={handoverReady ? 'true' : 'false'}
        >
            {loading && <div className="p-8 text-center text-gray-500">Loading document...</div>}
            {!loading && (!vehicle || !historyEntry) && (
                <div className="p-8 text-center text-red-500">Handover record not found</div>
            )}
            {!loading && vehicle && historyEntry ? (
                <VehicleHandoverFormView
                    historyEntry={historyEntry}
                    vehicle={vehicle}
                    isPrint
                />
            ) : null}
        </div>
    );
}

export default function VehicleHandoverPrintPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center">Loading context...</div>}>
            <VehicleHandoverPrintContent />
        </Suspense>
    );
}
