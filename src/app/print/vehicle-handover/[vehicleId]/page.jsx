'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import axiosInstance from '@/utils/axios';
import VehicleHandoverFormView from '../../../HRM/Asset/Vehicle/components/VehicleHandoverFormView';
import { prepareImagesForPdfCapture } from '../../../HRM/Asset/Vehicle/utils/compressImageForPdf';
import { enrichVehicleWithLocatorKm } from '../../../HRM/Asset/Vehicle/utils/enrichVehicleWithLocatorKm';
import {
    PDF_IMAGE_MAX_EDGE,
    PDF_JPEG_QUALITY,
    PDF_PAGE_SURFACE_CLASS,
} from '../../../HRM/Asset/Vehicle/utils/vehicleHandoverFormPdfConstants';

function VehicleHandoverPrintContent() {
    const params = useParams();
    const searchParams = useSearchParams();
    const vehicleId = params?.vehicleId;
    const historyId = searchParams.get('historyId');

    const [vehicle, setVehicle] = useState(null);
    const [historyEntry, setHistoryEntry] = useState(null);
    const [loading, setLoading] = useState(true);
    const [imagesCompressed, setImagesCompressed] = useState(false);
    const [paginationReady, setPaginationReady] = useState(false);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            if (!vehicleId || !historyId) {
                setLoading(false);
                return;
            }

            setImagesCompressed(false);

            try {
                const [vehicleRes, historyRes] = await Promise.all([
                    axiosInstance.get(`/AssetItem/detail/${vehicleId}`),
                    axiosInstance.get(`/AssetItem/history-record/${historyId}`),
                ]);
                if (cancelled) return;
                const vehicleData = await enrichVehicleWithLocatorKm(vehicleRes.data);
                if (cancelled) return;
                setVehicle(vehicleData);
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

    useEffect(() => {
        if (loading || !vehicle || !historyEntry) {
            setImagesCompressed(false);
            setPaginationReady(false);
            return;
        }

        let cancelled = false;
        const timer = window.setTimeout(async () => {
            const root = document.getElementById('vehicle-handover-print-root');
            if (root) {
                await prepareImagesForPdfCapture(root, {
                    maxEdge: PDF_IMAGE_MAX_EDGE,
                    quality: PDF_JPEG_QUALITY,
                    pageSurfaceClass: PDF_PAGE_SURFACE_CLASS,
                });
            }
            if (!cancelled) setImagesCompressed(true);
        }, 400);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [loading, vehicle, historyEntry]);

    useEffect(() => {
        if (loading || !vehicle || !historyEntry) {
            setPaginationReady(false);
            return undefined;
        }

        let cancelled = false;
        const check = () => {
            const form = document.getElementById('vehicle-handover-form-view');
            const ready = form?.getAttribute('data-pdf-pagination-ready') === 'true';
            if (ready && !cancelled) {
                setPaginationReady(true);
                return true;
            }
            return false;
        };

        if (check()) return undefined;

        const interval = window.setInterval(() => {
            if (check()) window.clearInterval(interval);
        }, 120);

        const timeout = window.setTimeout(() => {
            window.clearInterval(interval);
            if (!cancelled) setPaginationReady(true);
        }, 8000);

        return () => {
            cancelled = true;
            window.clearInterval(interval);
            window.clearTimeout(timeout);
        };
    }, [loading, vehicle, historyEntry, imagesCompressed]);

    const handoverReady =
        !loading && !!vehicle && !!historyEntry && imagesCompressed && paginationReady;

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
