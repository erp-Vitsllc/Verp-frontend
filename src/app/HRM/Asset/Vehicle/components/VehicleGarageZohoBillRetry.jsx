'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { parseVehicleServiceRemark } from './vehicleServiceUtils';

/**
 * Auto-retries Zoho bill create when Accounts approve already ran but bill_number failed.
 */
export default function VehicleGarageZohoBillRetry({
    vehicleId,
    serviceId,
    service,
    serviceTypeLabel = '',
    onUpdated,
}) {
    const { toast } = useToast();
    const [retrying, setRetrying] = useState(false);
    const attemptedKey = useRef('');

    const remark = parseVehicleServiceRemark(service) || {};
    const zohoBillId = String(remark.zohoBillId || '').trim();
    const zohoSyncError = String(remark.zohoSyncError || '').trim();
    const needsRetry = Boolean(zohoSyncError && !zohoBillId && vehicleId && serviceId);

    useEffect(() => {
        if (!needsRetry) return;
        const key = `${serviceId}:${zohoSyncError}`;
        if (attemptedKey.current === key) return;
        attemptedKey.current = key;

        let cancelled = false;
        (async () => {
            setRetrying(true);
            try {
                const { data } = await axiosInstance.post(
                    `/AssetItem/${vehicleId}/service/${serviceId}/garage-zoho-bill`,
                    { serviceTypeLabel },
                    { skipToast: true },
                );
                if (cancelled) return;
                if (typeof onUpdated === 'function' && data?.asset) onUpdated(data.asset);
                if (data?.zohoBillOk) {
                    toast({
                        title: 'Zoho bill created',
                        description: data?.zohoBillMessage || data?.message || 'Garage bill stored in Zoho.',
                    });
                } else {
                    toast({
                        variant: 'destructive',
                        title: 'Zoho bill still failed',
                        description: data?.zohoBillMessage || data?.message || zohoSyncError,
                    });
                }
            } catch (error) {
                if (cancelled) return;
                toast({
                    variant: 'destructive',
                    title: 'Zoho bill retry failed',
                    description: error.response?.data?.message || error.message || zohoSyncError,
                });
            } finally {
                if (!cancelled) setRetrying(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [needsRetry, vehicleId, serviceId, zohoSyncError, serviceTypeLabel, onUpdated, toast]);

    if (!needsRetry && !retrying) return null;

    return (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {retrying ? (
                <span className="inline-flex items-center gap-2 font-semibold">
                    <Loader2 size={14} className="animate-spin" />
                    Creating Zoho bill…
                </span>
            ) : zohoBillId ? null : (
                <span>
                    Zoho bill pending
                    {zohoSyncError ? `: ${zohoSyncError}` : ''}. Retrying automatically…
                </span>
            )}
        </div>
    );
}
