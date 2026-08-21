'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import axiosInstance from '@/utils/axios';
import AssetManagementDashboard from '@/app/HRM/Asset/components/AssetManagementDashboard';
import PendingAssetRequestsModal from '@/app/HRM/Asset/components/PendingAssetRequestsModal';
import {
    ASSET_PENDING_INBOX_CHANGED,
} from '@/app/HRM/Asset/utils/assetPendingInboxCount';
import { fetchAssetPendingInbox } from '@/utils/pendingInboxFetch';
import { fetchUtilityEntries, fetchUtilityTypeNames } from '@/app/HRM/Asset/UtilityBills/utils/utilityBillsApi';
import { utilityBillYears } from '@/app/HRM/Asset/UtilityBills/utils/utilityOverviewStats';

function mergeToolsRows(primary, extra) {
    const byId = new Map();
    for (const row of Array.isArray(primary) ? primary : []) {
        if (row?._id) byId.set(String(row._id), row);
    }
    for (const row of Array.isArray(extra) ? extra : []) {
        if (!row?._id) continue;
        const key = String(row._id);
        if (!byId.has(key)) byId.set(key, row);
    }
    return Array.from(byId.values());
}

export default function AssetManagementDashboardPage() {
    const [mounted, setMounted] = useState(false);
    const [fleet, setFleet] = useState(null);
    const [tools, setTools] = useState([]);
    const [utilityTypes, setUtilityTypes] = useState([]);
    const [utilityEntries, setUtilityEntries] = useState([]);
    const [utilityBills, setUtilityBills] = useState([]);
    const [inbox, setInbox] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [periodYear, setPeriodYear] = useState(String(new Date().getFullYear()));
    const [inboxOpen, setInboxOpen] = useState(false);

    const loadDashboard = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const fleetP = axiosInstance.get('/AssetItem/vehicle-fleet-dashboard', { skipToast: true }).catch(() => ({ data: null }));
            const toolsMineP = axiosInstance.get('/AssetType', { params: { scope: 'tools', view: 'mine' }, skipToast: true }).catch(() => ({ data: [] }));
            const toolsRestP = axiosInstance.get('/AssetType', { params: { scope: 'tools', view: 'rest' }, skipToast: true }).catch(() => ({ data: [] }));
            const typesP = fetchUtilityTypeNames().catch(() => []);
            const entriesP = fetchUtilityEntries().catch(() => []);
            const inboxP = fetchAssetPendingInbox(axiosInstance, { inboxScope: 'all', skipSync: true }).catch(() => []);

            const billsP = Promise.all([typesP, entriesP]).then(([typeNames, entries]) => {
                const names = (Array.isArray(typeNames) ? typeNames : [])
                    .map((name) => String(name?.name || name || '').trim())
                    .filter(Boolean);
                const uniqueNames = names.length
                    ? names
                    : [...new Set((entries || []).map((entry) => String(entry?.type || '').trim()).filter(Boolean))];
                setUtilityTypes(uniqueNames);
                setUtilityEntries(Array.isArray(entries) ? entries : []);
                if (!uniqueNames.length) return [];
                return Promise.all(
                    uniqueNames.map((utilityType) =>
                        axiosInstance
                            .get('/UtilityBill', { params: { utilityType }, skipToast: true })
                            .then((res) => (Array.isArray(res.data?.bills) ? res.data.bills : []))
                            .catch(() => []),
                    ),
                );
            });

            const [fleetRes, toolsMineRes, toolsRestRes, inboxRows] = await Promise.all([
                fleetP,
                toolsMineP,
                toolsRestP,
                inboxP,
            ]);

            setFleet(fleetRes.data || null);
            setTools(mergeToolsRows(toolsMineRes.data, toolsRestRes.data));
            setInbox(Array.isArray(inboxRows) ? inboxRows : []);
            setLoading(false);

            const billGroups = await billsP;
            setUtilityBills(Array.isArray(billGroups) ? billGroups.flat() : []);
        } catch (err) {
            setError(err?.response?.data?.message || 'Failed to load asset dashboard');
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        setMounted(true);
        loadDashboard();
    }, [loadDashboard]);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const refreshInbox = () => {
            fetchAssetPendingInbox(axiosInstance, { inboxScope: 'all', skipSync: true, force: true })
                .then((rows) => setInbox(Array.isArray(rows) ? rows : []))
                .catch(() => {});
        };
        window.addEventListener(ASSET_PENDING_INBOX_CHANGED, refreshInbox);
        return () => window.removeEventListener(ASSET_PENDING_INBOX_CHANGED, refreshInbox);
    }, []);

    const periodYears = useMemo(() => {
        const years = new Set([new Date().getFullYear()]);
        for (const year of fleet?.periodYears || []) years.add(Number(year));
        for (const year of utilityBillYears(utilityBills)) years.add(Number(year));
        return [...years].filter((year) => Number.isFinite(year)).sort((a, b) => b - a);
    }, [fleet?.periodYears, utilityBills]);

    if (!mounted) return null;

    return (
        <PermissionGuard
            moduleIds={['hrm_asset', 'hrm_asset_vehicle', 'hrm_asset_tools']}
            redirectTo="/dashboard"
        >
            <div className="flex min-h-screen bg-[#FAFAFB]">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0">
                    <Navbar />
                    <main className="flex-1 min-w-0 overflow-x-hidden">
                        <AssetManagementDashboard
                            fleet={fleet}
                            tools={tools}
                            utilityTypes={utilityTypes}
                            utilityEntries={utilityEntries}
                            utilityBills={utilityBills}
                            inbox={inbox}
                            loading={loading}
                            error={error}
                            periodYear={periodYear}
                            periodYears={periodYears}
                            onPeriodYearChange={setPeriodYear}
                            onOpenInbox={() => setInboxOpen(true)}
                        />
                    </main>
                </div>
            </div>

            <PendingAssetRequestsModal
                isOpen={inboxOpen}
                inboxScope="all"
                onClose={() => {
                    setInboxOpen(false);
                    fetchAssetPendingInbox(axiosInstance, { inboxScope: 'all', skipSync: true, force: true })
                        .then((rows) => setInbox(Array.isArray(rows) ? rows : []))
                        .catch(() => {});
                }}
                onRefreshParent={loadDashboard}
            />
        </PermissionGuard>
    );
}
