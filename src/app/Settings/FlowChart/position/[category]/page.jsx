'use client';

import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import axiosInstance from '@/utils/axios';
import { ArrowLeft, Package, Car, Building2 } from 'lucide-react';

const LABELS = {
    hr: 'HR',
    assigneduser: 'Assigned User',
    admincontroller: 'Admin',
    assetcontroller: 'Asset Controller'
};

const normCat = (c) => (c || '').toString().toLowerCase().replace(/\s+/g, '');
const isCompanyAssetCoordinatorView = (c) => {
    const n = normCat(c);
    return n === 'hr' || n === 'assigneduser' || n === 'admincontroller';
};

export default function FlowchartPositionPage() {
    const router = useRouter();
    const { category } = useParams();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setLoading(true);
                const res = await axiosInstance.get(`/Flowchart/position-summary/${encodeURIComponent(category)}`);
                if (!cancelled) setData(res.data);
            } catch (e) {
                if (!cancelled) setErr(e.response?.data?.message || 'Failed to load summary');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [category]);

    const title = LABELS[normCat(category)] || LABELS[category] || category;
    const denied = data && data.canViewInventory === false;
    const allowed = data && data.canViewInventory !== false;

    return (
        <div className="flex h-screen bg-[#F8FAFC]">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
                <Navbar />
                <main className="flex-1 overflow-y-auto bg-slate-50/50 p-8">
                    <div className="max-w-5xl mx-auto">
                        <button
                            type="button"
                            onClick={() => router.push('/Settings/FlowChart')}
                            className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-blue-600 mb-6"
                        >
                            <ArrowLeft size={18} /> Back to Flowchart
                        </button>

                        <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 p-10">
                            <h1 className="text-2xl font-black text-slate-900 mb-2">Position overview: {title}</h1>
                            <p className="text-slate-500 text-sm font-medium mb-6">
                                {normCat(category) === 'assetcontroller'
                                    ? 'Unassigned pool and parking (On Leave) are separate lists. Accessories appear under each main asset.'
                                    : 'Read-only snapshot for this role.'}
                            </p>

                            {loading && <p className="text-slate-400 font-bold">Loading…</p>}
                            {err && <p className="text-red-600 font-bold">{err}</p>}

                            {denied && data.viewerNote && (
                                <div className="rounded-2xl border border-amber-200 bg-amber-50 text-amber-900 px-5 py-4 text-sm font-bold leading-relaxed">
                                    {data.viewerNote}
                                </div>
                            )}

                            {!loading && !err && allowed && data && isCompanyAssetCoordinatorView(category) && (
                                <div className="space-y-8">
                                    <section>
                                        <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-3">
                                            {normCat(category) === 'hr' ? 'HR responsibilities' : 'Company assets (Assigned User / Admin)'}
                                        </h2>
                                        <ul className="list-disc pl-5 space-y-2 text-slate-700 text-sm">
                                            {(data.hrBullets || []).map((b, i) => (
                                                <li key={i}>{b}</li>
                                            ))}
                                        </ul>
                                    </section>
                                    <section>
                                        <h2 className="flex items-center gap-2 text-sm font-black text-slate-400 uppercase tracking-widest mb-3">
                                            <Building2 size={16} /> Company-allocated assets
                                        </h2>
                                        <div className="rounded-2xl border border-slate-100 overflow-hidden">
                                            <table className="w-full text-sm">
                                                <thead className="bg-slate-50 text-left text-xs font-black text-slate-500 uppercase">
                                                    <tr>
                                                        <th className="px-4 py-3">Asset ID</th>
                                                        <th className="px-4 py-3">Name</th>
                                                        <th className="px-4 py-3">Status</th>
                                                        <th className="px-4 py-3"></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(data.companyAssets || []).length === 0 ? (
                                                        <tr><td colSpan={4} className="px-4 py-6 text-slate-400 text-center">None</td></tr>
                                                    ) : (
                                                        (data.companyAssets || []).map((a) => (
                                                            <tr key={a._id} className="border-t border-slate-50">
                                                                <td className="px-4 py-2 font-mono text-xs">{a.assetId}</td>
                                                                <td className="px-4 py-2">{a.name}</td>
                                                                <td className="px-4 py-2">{a.status}</td>
                                                                <td className="px-4 py-2 text-right">
                                                                    <Link href={`/HRM/Asset/details/${a._id}`} className="text-blue-600 font-bold text-xs hover:underline">Open</Link>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </section>
                                </div>
                            )}

                            {!loading && !err && allowed && data && normCat(category) === 'assetcontroller' && (
                                <div className="space-y-10">
                                    <section className="rounded-[1.5rem] border-2 border-slate-200 bg-slate-50/40 p-6">
                                        <h2 className="flex items-center gap-2 text-sm font-black text-slate-700 uppercase tracking-widest mb-1">
                                            <Package size={18} className="text-slate-600" />
                                            Unassigned / pool
                                        </h2>
                                        <p className="text-xs text-slate-500 mb-4 font-medium">
                                            Assets in the pool (Unassigned, Returned, Draft, or assignment Pending). Accessories are nested under each row.
                                        </p>
                                        <AssetTableWithAccessories rows={data.unassignedAssets} showStatus />
                                    </section>

                                    <section className="rounded-[1.5rem] border-2 border-amber-200/80 bg-amber-50/30 p-6">
                                        <h2 className="flex items-center gap-2 text-sm font-black text-amber-900 uppercase tracking-widest mb-1">
                                            <Car size={18} className="text-amber-700" />
                                            Parking / On Leave
                                        </h2>
                                        <p className="text-xs text-amber-900/70 mb-4 font-medium">
                                            Assets currently parked (On Leave). Separate from the unassigned pool. Accessories are nested under each row.
                                        </p>
                                        <AssetTableWithAccessories rows={data.parkingAssets} showStatus />
                                    </section>
                                </div>
                            )}

                            {!loading && !err && allowed && data && !isCompanyAssetCoordinatorView(category) && normCat(category) !== 'assetcontroller' && (
                                <p className="text-slate-500">No dedicated preview for this category.</p>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}

function AssetTableWithAccessories({ rows, showStatus }) {
    if (!rows || rows.length === 0) {
        return <p className="text-slate-400 text-sm font-medium">None</p>;
    }
    return (
        <div className="rounded-2xl border border-slate-100 overflow-x-auto bg-white">
            <table className="w-full text-sm min-w-[480px]">
                <thead className="bg-slate-50 text-left text-xs font-black text-slate-500 uppercase">
                    <tr>
                        <th className="px-4 py-3 w-[28%]">Asset ID</th>
                        <th className="px-4 py-3">Name</th>
                        {showStatus && <th className="px-4 py-3 w-[14%]">Status</th>}
                        <th className="px-4 py-3 w-[12%] text-right"></th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((a) => {
                        const accs = Array.isArray(a.accessories) ? a.accessories : [];
                        return (
                            <Fragment key={a._id}>
                                <tr className="border-t border-slate-100">
                                    <td className="px-4 py-2.5 font-mono text-xs align-top">{a.assetId}</td>
                                    <td className="px-4 py-2.5 font-bold text-slate-800 align-top">{a.name}</td>
                                    {showStatus && (
                                        <td className="px-4 py-2.5 align-top text-slate-600">{a.status || '—'}</td>
                                    )}
                                    <td className="px-4 py-2.5 text-right align-top">
                                        <Link href={`/HRM/Asset/details/${a._id}`} className="text-blue-600 font-bold text-xs hover:underline whitespace-nowrap">
                                            Open
                                        </Link>
                                    </td>
                                </tr>
                                <tr className="border-t border-slate-50 bg-slate-50/60">
                                    <td
                                        colSpan={showStatus ? 4 : 3}
                                        className="px-4 py-3 pl-8 text-xs text-slate-600"
                                    >
                                        <span className="font-black text-slate-400 uppercase tracking-wider text-[10px] block mb-1.5">
                                            Attached accessories
                                        </span>
                                        {accs.length === 0 ? (
                                            <span className="text-slate-400 italic">No accessories on this asset</span>
                                        ) : (
                                            <ul className="list-disc pl-4 space-y-1 text-slate-700">
                                                {accs.map((acc, i) => (
                                                    <li key={i}>
                                                        <span className="font-semibold">{acc.name || 'Accessory'}</span>
                                                        {acc.accessoryId != null && acc.accessoryId !== '' && (
                                                            <span className="text-slate-300"> · </span>
                                                        )}
                                                        {acc.accessoryId != null && acc.accessoryId !== '' && (
                                                            <span className="font-mono text-[11px] text-slate-500">{acc.accessoryId}</span>
                                                        )}
                                                        {acc.status && (
                                                            <span className="text-slate-500"> — {acc.status}</span>
                                                        )}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </td>
                                </tr>
                            </Fragment>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
