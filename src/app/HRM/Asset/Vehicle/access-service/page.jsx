'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { vehicleAccessPath } from '@/app/HRM/Asset/Vehicle/utils/vehicleAccessNav';

export default function VehicleAccessServiceRedirectPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace(vehicleAccessPath('service'));
    }, [router]);
    return null;
}
