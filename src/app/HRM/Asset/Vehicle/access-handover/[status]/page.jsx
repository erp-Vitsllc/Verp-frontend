'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    vehicleAccessHandoverListPath,
    vehicleAccessHandoverStatusFromSlug,
    vehicleAccessPath,
} from '@/app/HRM/Asset/Vehicle/utils/vehicleAccessNav';

export default function VehicleAccessHandoverStatusRedirectPage() {
    const router = useRouter();
    const params = useParams();
    useEffect(() => {
        const status = vehicleAccessHandoverStatusFromSlug(params?.status);
        router.replace(status?.key ? vehicleAccessHandoverListPath(status.key) : vehicleAccessPath('handover'));
    }, [router, params?.status]);
    return null;
}
