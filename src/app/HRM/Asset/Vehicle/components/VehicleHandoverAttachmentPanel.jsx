'use client';

import { useCallback, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import VehicleHandoverFormView from './VehicleHandoverFormView';
import { downloadVehicleHandoverPdfFromDom } from '../utils/vehicleHandoverClientPdf';

async function parseBlobErrorMessage(data) {
    if (!(data instanceof Blob)) return null;
    try {
        const parsed = JSON.parse(await data.text());
        return parsed?.message || null;
    } catch {
        return null;
    }
}

export default function VehicleHandoverAttachmentPanel({
    vehicle,
    historyEntry,
    vehicleId,
}) {
    const { toast } = useToast();
    const [downloading, setDownloading] = useState(false);

    const historyId = historyEntry?._id;
    const canDownload = historyId && !String(historyId).startsWith('live-');

    const handleDownload = useCallback(async () => {
        if (!canDownload || !vehicleId) return;
        setDownloading(true);

        const filename = `Vehicle-Handover-${vehicle?.assetId || vehicleId}-${String(historyId).slice(-8)}.pdf`;

        try {
            toast({
                title: 'Preparing PDF',
                description: 'Compressing images for download…',
            });
            await downloadVehicleHandoverPdfFromDom({ filename });
            toast({ title: 'Downloaded', description: 'Vehicle handover PDF saved.' });
            return;
        } catch (clientError) {
            console.warn('Client PDF capture failed, trying server generation:', clientError);
        }

        try {
            const response = await axiosInstance.get(
                `/AssetItem/vehicle-handover-pdf/${vehicleId}?historyId=${historyId}`,
                { responseType: 'blob' },
            );

            const contentType = (response.headers['content-type'] || '').toLowerCase();
            if (!contentType.includes('application/pdf')) {
                const serverMessage = await parseBlobErrorMessage(response.data);
                throw new Error(serverMessage || 'The server did not return a PDF.');
            }

            const url = window.URL.createObjectURL(response.data);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast({ title: 'Downloaded', description: 'Vehicle handover PDF saved.' });
        } catch (error) {
            const responseData = error?.response?.data;
            const serverMessage = await parseBlobErrorMessage(responseData);
            toast({
                variant: 'destructive',
                title: 'Download failed',
                description:
                    serverMessage ||
                    error?.message ||
                    'Could not generate the handover PDF.',
            });
        } finally {
            setDownloading(false);
        }
    }, [canDownload, historyId, toast, vehicle?.assetId, vehicleId]);

    if (!vehicle || !historyEntry) return null;

    return (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:p-6">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
                <div>
                    <h2 className="text-lg font-bold text-gray-900">Handover Attachment</h2>
                    <p className="text-sm text-gray-500">
                        Official vehicle handover form with assignment data filled in.
                    </p>
                </div>
                {canDownload ? (
                    <button
                        type="button"
                        onClick={handleDownload}
                        disabled={downloading}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
                    >
                        {downloading ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
                        Download PDF
                    </button>
                ) : null}
            </div>
            <div className="overflow-x-auto">
                <VehicleHandoverFormView historyEntry={historyEntry} vehicle={vehicle} />
            </div>
        </div>
    );
}
