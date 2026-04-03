'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import axiosInstance from '@/utils/axios';
import Link from 'next/link';

function AssetCard({ asset, showAccessories }) {
    const accs = Array.isArray(asset?.accessories) ? asset.accessories : [];
    return (
        <div style={{ marginTop: 10, padding: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10 }}>
            <div style={{ fontWeight: 'bold', color: '#0f172a', fontSize: 13 }}>
                {asset?.assetId || ''} — {asset?.name || ''}
            </div>
            {asset?.status ? (
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>
                    Status: {asset.status}
                </div>
            ) : null}

            {showAccessories ? (
                <div style={{ marginTop: 6 }}>
                    {accs.length === 0 ? (
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>No accessories attached</div>
                    ) : (
                        <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
                            {accs.slice(0, 12).map((acc, i) => (
                                <li key={i} style={{ fontSize: 11, color: '#334155', margin: '2px 0' }}>
                                    <strong>{acc?.name || 'Accessory'}</strong>
                                    {acc?.accessoryId ? ` (${acc.accessoryId})` : ''}
                                    {acc?.status ? ` — ${acc.status}` : ''}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            ) : null}

            <div style={{ marginTop: 6, fontSize: 11 }}>
                <Link href={`/HRM/Asset/details/${asset?._id || asset?.id}`} style={{ color: '#2563eb', fontWeight: 'bold' }}>
                    Open
                </Link>
            </div>
        </div>
    );
}

export default function FlowchartPositionAssetsPrintPage() {
    const params = useParams();
    const searchParams = useSearchParams();

    const category = params.category;
    const previewAs = searchParams.get('previewAs') || null;

    const [data, setData] = useState(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setReady(false);
                const base = `/Flowchart/position-summary/${encodeURIComponent(category)}`;
                const url = previewAs ? `${base}?previewAs=${encodeURIComponent(previewAs)}` : base;
                const res = await axiosInstance.get(url);
                if (!cancelled) setData(res.data);
            } catch {
                if (!cancelled) setData(null);
            } finally {
                if (!cancelled) setReady(true);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [category, previewAs]);

    return (
        <div
            id="flowchart-inventory-container"
            data-ready={ready ? 'true' : 'false'}
            style={{ padding: 20, background: 'white', fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif' }}
        >
            {!ready ? <div>Loading…</div> : null}

            {ready && !data ? <div>Preview not available.</div> : null}

            {ready && data && data.canViewInventory === false ? (
                <div style={{ color: '#b45309', fontWeight: 'bold' }}>
                    {data.viewerNote || 'Not authorized to view this preview.'}
                </div>
            ) : null}

            {ready && data && data.canViewInventory !== false && category === 'hr' ? (
                <div>
                    <h1 style={{ fontSize: 18, fontWeight: 'bold', margin: 0 }}>HR responsibility preview</h1>
                    <div style={{ marginTop: 10 }}>
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                            {(data.hrBullets || []).map((b, i) => (
                                <li key={i} style={{ fontSize: 12, color: '#334155', margin: '4px 0' }}>
                                    {b}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div style={{ marginTop: 12 }}>
                        <h2 style={{ fontSize: 14, fontWeight: 'bold', margin: 0 }}>Company assets</h2>
                        {(data.companyAssets || []).slice(0, 40).map((a) => (
                            <AssetCard key={a._id} asset={a} showAccessories={false} />
                        ))}
                    </div>
                </div>
            ) : null}

            {ready && data && data.canViewInventory !== false && category === 'assetcontroller' ? (
                <div>
                    <h1 style={{ fontSize: 18, fontWeight: 'bold', margin: 0 }}>Asset Controller inventory preview</h1>

                    <div style={{ marginTop: 14 }}>
                        <h2 style={{ fontSize: 14, fontWeight: 'bold', margin: 0 }}>Unassigned / pool</h2>
                        {(data.unassignedAssets || []).slice(0, 40).map((a) => (
                            <AssetCard key={a._id} asset={a} showAccessories />
                        ))}
                    </div>

                    <div style={{ marginTop: 14 }}>
                        <h2 style={{ fontSize: 14, fontWeight: 'bold', margin: 0 }}>Parking / On Leave</h2>
                        {(data.parkingAssets || []).slice(0, 40).map((a) => (
                            <AssetCard key={a._id} asset={a} showAccessories />
                        ))}
                    </div>
                </div>
            ) : null}
        </div>
    );
}

