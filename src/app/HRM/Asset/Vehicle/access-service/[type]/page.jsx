'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    vehicleAccessPath,
    vehicleAccessServiceListPath,
    vehicleAccessServiceTypeFromSlug,
} from '@/app/HRM/Asset/Vehicle/utils/vehicleAccessNav';

export default function VehicleAccessServiceTypeRedirectPage() {
    const router = useRouter();
    const params = useParams();
    useEffect(() => {
        const type = vehicleAccessServiceTypeFromSlug(params?.type);
        router.replace(type ? vehicleAccessServiceListPath(type) : vehicleAccessPath('service'));
    }, [router, params?.type]);
    return null;
}
