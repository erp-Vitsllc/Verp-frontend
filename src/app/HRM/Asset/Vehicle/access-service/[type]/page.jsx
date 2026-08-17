'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { navigateFromList } from '@/utils/listReturnNavigation';
import VehicleAccessPageShell from '@/app/HRM/Asset/Vehicle/components/VehicleAccessPageShell';
import VehicleOilServiceRequestTable from '@/app/HRM/Asset/Vehicle/components/VehicleOilServiceRequestTable';
import VehicleCarWashRequestTable from '@/app/HRM/Asset/Vehicle/components/VehicleCarWashRequestTable';
import VehicleServiceTabRequestTable from '@/app/HRM/Asset/Vehicle/components/VehicleServiceTabRequestTable';
import {
    buildVehicleAccessServiceRowsFromAsset,
    buildVehicleServiceListRowHref,
} from '@/app/HRM/Asset/Vehicle/components/vehicleServiceUtils';
import { vehicleAccessServiceTypeFromSlug } from '@/app/HRM/Asset/Vehicle/utils/vehicleAccessNav';

export default function VehicleAccessServiceTypeListPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const serviceType = vehicleAccessServiceTypeFromSlug(params?.type);

    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        if (!serviceType) {
            setVehicles([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const res = await axiosInstance.get('/AssetItem/vehicle-access-services', {
                params: { type: serviceType },
            });
            setVehicles(Array.isArray(res.data?.items) ? res.data.items : []);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Could not load services',
                description: error?.response?.data?.message || 'Try again in a moment.',
            });
            setVehicles([]);
        } finally {
            setLoading(false);
        }
    }, [serviceType, toast]);

    useEffect(() => {
        load();
    }, [load]);

    const rows = useMemo(() => {
        const all = vehicles.flatMap((asset) => buildVehicleAccessServiceRowsFromAsset(asset, serviceType));
        all.sort((a, b) => {
            const ta = new Date(a.sortDate || a.requestDate || a.createdAt || 0).getTime();
            const tb = new Date(b.sortDate || b.requestDate || b.createdAt || 0).getTime();
            return tb - ta;
        });
        return all.map((row, index) => ({ ...row, slNo: all.length - index }));
    }, [vehicles, serviceType]);

    const openRow = (row) => {
        const href = buildVehicleServiceListRowHref(row);
        if (!href) return;
        navigateFromList(router, href);
    };

    if (!serviceType) {
        return (
            <VehicleAccessPageShell title="Service lists" subtitle="Unknown service type">
                <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-sm text-slate-500">
                    That service type was not found.
                </div>
            </VehicleAccessPageShell>
        );
    }

    return (
        <VehicleAccessPageShell
            title={`${serviceType} Service Lists`}
            subtitle={`Every ${serviceType.toLowerCase()} record across all vehicles`}
            count={loading ? null : rows.length}
            onRefresh={load}
            refreshing={loading}
        >
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="py-16 text-center text-sm text-slate-500">Loading {serviceType} lists…</div>
                ) : serviceType === 'Oil Service' ? (
                    <VehicleOilServiceRequestTable
                        rows={rows}
                        emptyHint="No oil service records on the fleet yet."
                        onRowClick={openRow}
                    />
                ) : serviceType === 'Car Wash' ? (
                    <VehicleCarWashRequestTable
                        rows={rows}
                        emptyHint="No car wash records on the fleet yet."
                        onRowClick={openRow}
                    />
                ) : (
                    <VehicleServiceTabRequestTable
                        rows={rows}
                        emptyHint={`No ${serviceType.toLowerCase()} records on the fleet yet.`}
                        onRowClick={openRow}
                    />
                )}
            </div>
        </VehicleAccessPageShell>
    );
}
