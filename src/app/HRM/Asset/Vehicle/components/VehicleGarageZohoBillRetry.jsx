'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { parseVehicleServiceRemark } from './vehicleServiceUtils';

/**
 * Auto-retries Zoho bill create when Accounts approve already ran but bill create failed.
 * Supports Accident Repair multi-bill (remark.zohoBills[]) — retries any bill missing zohoBillId.
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
    const multiBills = Array.isArray(remark.zohoBills) ? remark.zohoBills : [];
    const pendingMulti = multiBills.filter((b) => !String(b?.zohoBillId || '').trim());
    const multiErrors = pendingMulti
        .map((b) => String(b?.zohoSyncError || '').trim())
        .filter(Boolean);
    const hasMultiPending = multiBills.length > 0 && pendingMulti.length > 0;
    const needsRetry = Boolean(
        vehicleId &&
            serviceId &&
            ((zohoSyncError && !zohoBillId && !multiBills.length) ||
                (hasMultiPending && (zohoSyncError || multiErrors.length))),
    );

    useEffect(() => {
        if (!needsRetry) return;
        const key = `${serviceId}:${zohoSyncError}:${pendingMulti.length}:${multiErrors.join('|')}`;
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
                        description:
                            data?.zohoBillMessage ||
                            data?.message ||
                            zohoSyncError ||
                            multiErrors[0] ||
                            'Zoho bill create failed.',
                    });
                }
            } catch (error) {
                if (cancelled) return;
                toast({
                    variant: 'destructive',
                    title: 'Zoho bill retry failed',
                    description:
                        error.response?.data?.message ||
                        error.message ||
                        zohoSyncError ||
                        multiErrors[0],
                });
            } finally {
                if (!cancelled) setRetrying(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [
        needsRetry,
        vehicleId,
        serviceId,
        zohoSyncError,
        serviceTypeLabel,
        onUpdated,
        toast,
        pendingMulti.length,
        multiErrors,
    ]);

    if (!needsRetry && !retrying) return null;

    return (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {retrying ? (
                <span className="inline-flex items-center gap-2 font-semibold">
                    <Loader2 size={14} className="animate-spin" />
                    Creating Zoho bill{hasMultiPending ? 's' : ''}…
                </span>
            ) : zohoBillId && !hasMultiPending ? null : (
                <span>
                    Zoho bill pending
                    {zohoSyncError || multiErrors[0]
                        ? `: ${zohoSyncError || multiErrors[0]}`
                        : ''}
                    . Retrying automatically…
                </span>
            )}
        </div>
    );
}
