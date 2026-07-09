'use client';

import { useCallback, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import axiosInstance from '@/utils/axios';
import VehicleHandoverFormView from './VehicleHandoverFormView';
import { downloadVehicleHandoverPdfFromDom } from '../utils/vehicleHandoverClientPdf';

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
                description: 'Generating the handover form with correct layout and photos…',
            });

            try {
                const response = await axiosInstance.get(
                    `/AssetItem/vehicle-handover-pdf/${vehicleId}`,
                    {
                        params: { historyId: String(historyId) },
                        responseType: 'blob',
                        timeout: 120000,
                        skipToast: true,
                    },
                );

                const blob = new Blob([response.data], { type: 'application/pdf' });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', filename);
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.URL.revokeObjectURL(url);
            } catch {
                await downloadVehicleHandoverPdfFromDom({ filename });
            }

            toast({ title: 'Downloaded', description: 'Vehicle handover PDF saved.' });
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Download failed',
                description: error?.message || 'Could not generate the handover PDF.',
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
