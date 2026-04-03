'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import axiosInstance from '@/utils/axios';

function AssetBulkInventoryPrintContent() {
    const searchParams = useSearchParams();
    const idsParam = searchParams.get('ids') || '';
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchItems = async () => {
            try {
                if (!idsParam.trim()) {
                    setItems([]);
                    return;
                }
                const res = await axiosInstance.get(`/AssetItem/bulk/print-inventory?ids=${encodeURIComponent(idsParam)}`);
                setItems(Array.isArray(res.data?.items) ? res.data.items : []);
            } catch (e) {
                console.error('Error loading bulk inventory for print:', e);
                setItems([]);
            } finally {
                setLoading(false);
            }
        };
        fetchItems();
    }, [idsParam]);

    const ready = !loading && idsParam.trim().length > 0;

    return (
        <div
            id="bulk-asset-inventory-pdf"
            className="bg-white min-h-[120px] p-6 text-slate-800"
            data-inventory-ready={ready ? 'true' : 'false'}
        >
            {loading && (
                <div className="p-8 text-center text-gray-500">Loading inventory…</div>
            )}
            {!loading && !idsParam.trim() && (
                <div className="p-8 text-center text-red-500">No asset IDs provided.</div>
            )}
            {!loading && idsParam.trim() && items.length === 0 && (
                <div className="p-8 text-center text-red-500">No assets found for this request.</div>
            )}
            {ready && items.length > 0 && (
                <div className="max-w-[900px] mx-auto">
                    <h1 className="text-xl font-bold text-slate-900 mb-1">Asset inventory</h1>
                    <p className="text-sm text-slate-500 mb-6">
                        {items.length} item{items.length === 1 ? '' : 's'} — generated for VeRP notification
                    </p>
                    <table className="w-full border-collapse text-sm">
                        <thead>
                            <tr className="border-b border-slate-300 bg-slate-50">
                                <th className="text-left py-2 px-2 font-semibold">Asset ID</th>
                                <th className="text-left py-2 px-2 font-semibold">Name</th>
                                <th className="text-left py-2 px-2 font-semibold">Category</th>
                                <th className="text-left py-2 px-2 font-semibold">Type</th>
                                <th className="text-left py-2 px-2 font-semibold">Status</th>
                                <th className="text-left py-2 px-2 font-semibold">Accessories</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((row) => (
                                <tr key={row._id} className="border-b border-slate-200 align-top">
                                    <td className="py-2 px-2 font-mono text-xs">{row.assetId}</td>
                                    <td className="py-2 px-2">{row.name}</td>
                                    <td className="py-2 px-2 text-slate-600">{row.categoryName}</td>
                                    <td className="py-2 px-2 text-slate-600">{row.typeName}</td>
                                    <td className="py-2 px-2">{row.status}</td>
                                    <td className="py-2 px-2 text-slate-700">
                                        {row.accessories?.length ? (
                                            <ul className="list-disc pl-4 m-0">
                                                {row.accessories.map((acc, i) => (
                                                    <li key={i}>
                                                        {acc.name}
                                                        {acc.status !== 'Attached' && acc.status !== '—' ? (
                                                            <span className="text-slate-500"> ({acc.status})</span>
                                                        ) : null}
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <span className="text-slate-400">—</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export default function AssetBulkInventoryPrintPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center">Loading…</div>}>
            <AssetBulkInventoryPrintContent />
        </Suspense>
    );
}
