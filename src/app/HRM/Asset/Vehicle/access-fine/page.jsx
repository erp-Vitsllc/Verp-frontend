'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { navigateFromList } from '@/utils/listReturnNavigation';
import { navHrefProps } from '@/utils/linkContextMenu';
import EmployeeNameLink from '@/components/EmployeeNameLink';
import {
    isVehicleAccessFineVisible,
    resolveVehicleAccessFineHref,
    resolveVehicleAccessOffender,
    resolveVehicleAccessVehicleHref,
} from '@/app/HRM/Asset/Vehicle/utils/vehicleAccessNav';
import VehicleAccessPageShell from '@/app/HRM/Asset/Vehicle/components/VehicleAccessPageShell';

function vehicleLabel(fine) {
    return fine?.assetName || fine?.assetId || fine?.vehicleId || '—';
}

function vehiclePlateNo(fine) {
    const combined = String(fine?.vehiclePlateNo || '').trim();
    if (combined) return combined;
    const plate = [fine?.plateEmirate, fine?.plateNumber].filter(Boolean).join(' ').trim();
    return plate || '—';
}

const CELL_LINK_CLASS = 'font-bold text-blue-600 hover:text-blue-800 hover:underline underline-offset-2';

function CellNavLink({ href, router, title, children }) {
    if (!href) return <span>{children}</span>;
    return (
        <a
            href={href}
            className={CELL_LINK_CLASS}
            title={title}
            onClick={(event) => {
                event.stopPropagation();
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
                event.preventDefault();
                navigateFromList(router, href);
            }}
            {...navHrefProps(href)}
        >
            {children}
        </a>
    );
}

export default function VehicleAccessFinePage() {
    const router = useRouter();
    const { toast } = useToast();
    const [fines, setFines] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axiosInstance.get('/Fine', {
                params: { vehicleLinked: '1', limit: 1000 },
            });
            const list = Array.isArray(res.data?.fines) ? res.data.fines : Array.isArray(res.data) ? res.data : [];
            setFines(list.filter(isVehicleAccessFineVisible));
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Could not load vehicle fines',
                description: error?.response?.data?.message || 'Try again in a moment.',
            });
            setFines([]);
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        load();
    }, [load]);

    const openFine = (fine) => {
        const href = resolveVehicleAccessFineHref(fine);
        if (!href) return;
        navigateFromList(router, href);
    };

    return (
        <VehicleAccessPageShell
            title="Access Vehicle Fine"
            subtitle="Approved, Zoho-entered, and completed fines linked to fleet vehicles"
            count={loading ? null : fines.length}
            onRefresh={load}
            refreshing={loading}
        >
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="py-16 text-center text-sm text-slate-500">Loading vehicle fines…</div>
                ) : fines.length === 0 ? (
                    <div className="py-16 text-center text-sm text-slate-500">
                        No approved, Zoho-entered, or completed vehicle fines.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[1040px]">
                            <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                <tr>
                                    <th className="px-6 py-4">Fine ID</th>
                                    <th className="px-6 py-4">Type</th>
                                    <th className="px-6 py-4">Vehicle</th>
                                    <th className="px-6 py-4">Plate No.</th>
                                    <th className="px-6 py-4">Offender</th>
                                    <th className="px-6 py-4">Amount</th>
                                    <th className="px-6 py-4">Date</th>
                                    <th className="px-6 py-4">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {fines.map((fine) => {
                                    const fineHref = resolveVehicleAccessFineHref(fine);
                                    const vehicleHref = resolveVehicleAccessVehicleHref(fine);
                                    const offender = resolveVehicleAccessOffender(fine);
                                    return (
                                        <tr
                                            key={fine._id}
                                            className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                                            {...navHrefProps(fineHref)}
                                            onClick={() => openFine(fine)}
                                        >
                                            <td className="px-6 py-4 text-sm">
                                                <CellNavLink href={fineHref} router={router} title="Open fine details">
                                                    {fine.fineId || '—'}
                                                </CellNavLink>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-bold text-slate-700">
                                                {fine.fineType || '—'}
                                            </td>
                                            <td className="px-6 py-4 text-sm">
                                                <CellNavLink
                                                    href={vehicleHref}
                                                    router={router}
                                                    title="Open vehicle details"
                                                >
                                                    {vehicleLabel(fine)}
                                                </CellNavLink>
                                            </td>
                                            <td className="px-6 py-4 text-sm whitespace-nowrap font-medium">
                                                <CellNavLink
                                                    href={vehicleHref}
                                                    router={router}
                                                    title="Open vehicle details"
                                                >
                                                    {vehiclePlateNo(fine)}
                                                </CellNavLink>
                                            </td>
                                            <td className="px-6 py-4 text-sm" onClick={(event) => event.stopPropagation()}>
                                                {offender.employeeId ? (
                                                    <EmployeeNameLink
                                                        employeeId={offender.employeeId}
                                                        name={offender.employeeName}
                                                        className={CELL_LINK_CLASS}
                                                        variant="inherit"
                                                    />
                                                ) : (
                                                    <span className="text-slate-600">{offender.employeeName}</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-black text-rose-600">
                                                AED {Number(fine.fineAmount || 0).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600">
                                                {fine.awardedDate
                                                    ? new Date(fine.awardedDate).toLocaleDateString()
                                                    : '—'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700">
                                                    {fine.fineStatus || '—'}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </VehicleAccessPageShell>
    );
}
