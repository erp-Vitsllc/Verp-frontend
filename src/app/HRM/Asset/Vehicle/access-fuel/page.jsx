'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { vehicleAccessPath } from '@/app/HRM/Asset/Vehicle/utils/vehicleAccessNav';

export default function VehicleAccessFuelRedirectPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace(vehicleAccessPath('fuel'));
    }, [router]);
    return null;
}
