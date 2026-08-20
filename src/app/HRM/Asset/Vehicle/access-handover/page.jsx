'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { vehicleAccessPath } from '@/app/HRM/Asset/Vehicle/utils/vehicleAccessNav';

export default function VehicleAccessHandoverRedirectPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace(vehicleAccessPath('handover'));
    }, [router]);
    return null;
}
