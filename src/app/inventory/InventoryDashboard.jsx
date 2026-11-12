'use client';

import {
    ArrowDown,
    ArrowUp,
    Box,
    Calendar,
    ClipboardList,
    Clock,
    Package,
    ShoppingCart,
    Truck,
    Users,
    Warehouse,
    Ban,
} from 'lucide-react';
import { Cell, Pie, PieChart, Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from 'recharts';
import RechartsBox from '@/components/charts/RechartsBox';

const CATEGORY_VALUE = [
    { name: 'Structured Cabling', value: 28, label: '28%', color: '#3B82F6' },
    { name: 'CCTV', value: 18, label: '18%', color: '#8B5CF6' },
    { name: 'Networking', value: 15, label: '15%', color: '#F59E0B' },
    { name: 'Access Control', value: 12, label: '12%', color: '#22C55E' },
    { name: 'Audio Visual', value: 10, label: '10%', color: '#EAB308' },
    { name: 'IP Telephony', value: 8, label: '8%', color: '#EC4899' },
    { name: 'Home Automation', value: 5, label: '5%', color: '#14B8A6' },
    { name: 'Others', value: 4, label: '4%', color: '#94A3B8' },
];

const MONTHLY_PURCHASE = [
    { month: 'Jan', value: 78000 },
    { month: 'Feb', value: 96000 },
    { month: 'Mar', value: 64000 },
    { month: 'Apr', value: 118000 },
    { month: 'May', value: 52000 },
    { month: 'Jun', value: 142000 },
    { month: 'Jul', value: 88000 },
    { month: 'Aug', value: 164000 },
    { month: 'Sep', value: 186000 },
];

const TOP_VENDORS = [
    { name: 'ABC Technology LLC', value: 320450 },
    { name: 'XYZ Solutions', value: 210300 },
    { name: 'Tech Source', value: 185600 },
    { name: 'Secure Plus LLC', value: 142200 },
    { name: 'AV World LLC', value: 98500 },
];

const LOW_STOCK = [
    { n: 1, item: 'DATACOM CAT6 Cable', available: 12, reorder: 25, uom: 'Box', status: 'Low Stock' },
    { n: 2, item: 'Huawei AP371', available: 2, reorder: 5, uom: 'Nos', status: 'Low Stock' },
    { n: 3, item: 'Hikvision IP Camera', available: 0, reorder: 5, uom: 'Nos', status: 'Out of Stock' },
    { n: 4, item: 'Logitech Rally Bar', available: 3, reorder: 10, uom: 'Nos', status: 'Low Stock' },
    { n: 5, item: 'Patch Panel 24 Port', available: 6, reorder: 20, uom: 'Nos', status: 'Low Stock' },
];

const RECENT_PURCHASES = [
    { po: 'PO-1254', vendor: 'ABC Technology', amount: 'AED 22,500', date: '20 Sep 2025', status: 'Received' },
    { po: 'PO-1253', vendor: 'Tech Source', amount: 'AED 18,400', date: '18 Sep 2025', status: 'Pending' },
    { po: 'PO-1252', vendor: 'XYZ Solutions', amount: 'AED 45,000', date: '12 Sep 2025', status: 'Received' },
    { po: 'PO-1251', vendor: 'AV World LLC', amount: 'AED 12,650', date: '10 Sep 2025', status: 'In Transit' },
    { po: 'PO-1250', vendor: 'Secure Plus', amount: 'AED 28,300', date: '01 Sep 2025', status: 'Received' },
];

const PRICE_CHANGES = [
    { product: 'DATACOM CAT6 Cable', vendor: 'ABC Technology', oldPrice: '425', newPrice: '450', up: true, date: '20 Sep 2025' },
    { product: 'Huawei AP371', vendor: 'Tech Source', oldPrice: '380', newPrice: '410', up: true, date: '18 Sep 2025' },
    { product: 'Hikvision Dome Camera', vendor: 'XYZ Solutions', oldPrice: '520', newPrice: '510', up: false, date: '15 Sep 2025' },
    { product: 'Logitech Rally Bar', vendor: 'AV World LLC', oldPrice: '2,100', newPrice: '2,250', up: true, date: '12 Sep 2025' },
    { product: 'Fiber Patch Cord', vendor: 'Secure Plus', oldPrice: '18', newPrice: '16', up: false, date: '05 Sep 2025' },
];

const WAREHOUSES = [
    { name: 'Main Warehouse', value: 350 },
    { name: 'Office Store', value: 120 },
    { name: 'Project ABC', value: 85 },
    { name: 'Service Team', value: 60 },
];

const STOCK_STATUS = [
    { name: 'In Stock', value: 1980, label: '1,980 (81%)', color: '#22C55E' },
    { name: 'Low Stock', value: 42, label: '42 (2%)', color: '#F59E0B' },
    { name: 'Out of Stock', value: 17, label: '17 (1%)', color: '#EF4444' },
    { name: 'Non-Stock', value: 210, label: '210 (9%)', color: '#3B82F6' },
    { name: 'Discontinued', value: 29, label: '29 (3%)', color: '#94A3B8' },
    { name: 'Others', value: 180, label: '180 (7%)', color: '#A855F7' },
];

const PO_STATUS = [
    { name: 'Draft', value: 5, label: '5 (18%)', color: '#94A3B8' },
    { name: 'Pending Approval', value: 8, label: '8 (29%)', color: '#F59E0B' },
    { name: 'Approved', value: 6, label: '6 (21%)', color: '#22C55E' },
    { name: 'In Transit', value: 4, label: '4 (14%)', color: '#3B82F6' },
    { name: 'Received', value: 4, label: '4 (14%)', color: '#14B8A6' },
    { name: 'Closed', value: 1, label: '1 (4%)', color: '#8B5CF6' },
];

const STATS = [
    { icon: Package, tint: 'bg-blue-50 text-blue-600', value: '2,458', label: 'Total Items', sub: 'Active Items: 2,312', change: '+12%' },
    { icon: Warehouse, tint: 'bg-emerald-50 text-emerald-600', value: 'AED 1,245,800', label: 'Inventory Value', sub: 'Across all warehouses', change: '+8%' },
    { icon: Box, tint: 'bg-orange-50 text-orange-500', value: '42', label: 'Low Stock Items', sub: 'Below reorder level', change: '' },
    { icon: Ban, tint: 'bg-red-50 text-red-500', value: '17', label: 'Out of Stock', sub: 'Need urgent purchase', change: '' },
    { icon: Users, tint: 'bg-violet-50 text-violet-600', value: '86', label: 'Active Vendors', sub: '12 new this month', change: '+7%' },
    { icon: ShoppingCart, tint: 'bg-sky-50 text-sky-600', value: '14', label: 'Pending RFQ', sub: 'Awaiting vendor response', change: '+27%' },
    { icon: ClipboardList, tint: 'bg-emerald-50 text-emerald-600', value: '8', label: 'Pending PO', sub: 'Awaiting approval', change: '' },
    { icon: Truck, tint: 'bg-rose-50 text-rose-500', value: '12', label: 'Goods Awaiting Receipt', sub: 'Confirmed but not received', change: '+33%' },
];

const STATUS_CLASS = {
    'Low Stock': 'bg-orange-50 text-orange-600',
    'Out of Stock': 'bg-red-50 text-red-600',
    Received: 'bg-emerald-50 text-emerald-600',
    Pending: 'bg-amber-50 text-amber-600',
    'In Transit': 'bg-blue-50 text-blue-600',
};

function aed(value) {
    return `AED ${value.toLocaleString('en-US')}`;
}

function Card({ title, action, children, className = '' }) {
    return (
        <section className={`bg-white rounded-xl border border-[#E6EDF5] shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-4 min-w-0 ${className}`}>
            {title ? (
                <div className="flex items-center justify-between gap-3 mb-3">
                    <h3 className="text-[13px] font-semibold text-slate-800">{title}</h3>
                    {action || null}
                </div>
            ) : null}
            {children}
        </section>
    );
}

function ViewAll() {
    return <span className="text-[12px] font-medium text-blue-600">View All</span>;
}

function StatusPill({ status }) {
    return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_CLASS[status] || 'bg-slate-100 text-slate-600'}`}>
            {status}
        </span>
    );
}

function Donut({ data, center, caption }) {
    return (
        <div className="flex items-center gap-2 min-w-0">
            <div className="relative h-[168px] w-[168px] shrink-0">
                <RechartsBox height={168} minHeight={168}>
                    <PieChart>
                        <Pie
                            data={data}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={52}
                            outerRadius={74}
                            paddingAngle={1.4}
                            stroke="#fff"
                            strokeWidth={2}
                        >
                            {data.map((entry) => (
                                <Cell key={entry.name} fill={entry.color} />
                            ))}
                        </Pie>
                    </PieChart>
                </RechartsBox>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[13px] font-bold text-slate-800 leading-tight text-center">{center}</span>
                    {caption ? <span className="text-[10px] text-slate-400">{caption}</span> : null}
                </div>
            </div>
            <ul className="flex-1 min-w-0 space-y-1.5">
                {data.map((item) => (
                    <li key={item.name} className="flex items-center gap-2 text-[11px] text-slate-600">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="min-w-0 flex-1 truncate">{item.name}</span>
                        <span className="shrink-0 font-medium text-slate-700">{item.label}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default function InventoryDashboard() {
    const maxVendor = TOP_VENDORS[0].value;

    return (
        <>
        <main className="flex-1 space-y-4 bg-[#F4F7FB] p-4 text-slate-800 lg:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-[22px] font-bold tracking-tight text-slate-900">Welcome back, Aadam!</h2>
                        <p className="text-[13px] text-slate-500">Here&apos;s what&apos;s happening with your inventory today.</p>
                    </div>
                    <div className="flex items-center gap-4 rounded-xl border border-[#E6EDF5] bg-white px-4 py-2.5 text-[12px] text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                        <span className="inline-flex items-center gap-2">
                            <Calendar size={14} className="text-blue-500" />
                            Sunday, 21 Sep 2025
                        </span>
                        <span className="inline-flex items-center gap-2">
                            <Clock size={14} className="text-blue-500" />
                            04:30 PM
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
                    {STATS.map((stat) => {
                        const Icon = stat.icon;
                        return (
                            <article key={stat.label} className="rounded-xl border border-[#E6EDF5] bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                                <div className="mb-2 flex items-start justify-between gap-2">
                                    <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${stat.tint}`}>
                                        <Icon size={16} />
                                    </span>
                                    {stat.change ? <span className="text-[11px] font-semibold text-emerald-500">{stat.change}</span> : <span />}
                                </div>
                                <p className="text-[16px] font-bold leading-tight text-slate-900">{stat.value}</p>
                                <p className="mt-0.5 text-[11px] font-medium text-slate-600">{stat.label}</p>
                                <p className="mt-0.5 text-[10px] text-slate-400">{stat.sub}</p>
                            </article>
                        );
                    })}
                </div>

                <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                    <Card title="Inventory Value by Category">
                        <Donut data={CATEGORY_VALUE} center="AED" caption="1.25M" />
                    </Card>
                    <Card
                        title="Monthly Purchase Value"
                        action={(
                            <span className="rounded-md border border-[#E6EDF5] bg-white px-2 py-1 text-[11px] text-slate-500">
                                2025
                            </span>
                        )}
                    >
                        <RechartsBox height={188} minHeight={188}>
                            <BarChart data={MONTHLY_PURCHASE} barSize={16} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                                <CartesianGrid vertical={false} stroke="#EEF2F7" />
                                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                                <YAxis
                                    ticks={[0, 50000, 100000, 150000, 200000]}
                                    domain={[0, 200000]}
                                    tickFormatter={(value) => (value === 0 ? '0' : `${value / 1000}K`)}
                                    tick={{ fontSize: 11, fill: '#94A3B8' }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </RechartsBox>
                    </Card>
                    <Card title="Top Vendors by Purchase Value">
                        <ul className="space-y-3 pt-1">
                            {TOP_VENDORS.map((vendor) => (
                                <li key={vendor.name} className="grid grid-cols-[118px_1fr_92px] items-center gap-2">
                                    <span className="truncate text-[11px] text-slate-500">{vendor.name}</span>
                                    <span className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                                        <span
                                            className="block h-full rounded-full bg-blue-500"
                                            style={{ width: `${Math.max(8, (vendor.value / maxVendor) * 100)}%` }}
                                        />
                                    </span>
                                    <span className="text-right text-[11px] font-medium text-slate-700">{aed(vendor.value)}</span>
                                </li>
                            ))}
                        </ul>
                    </Card>
                </div>

                <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                    <Card title="Low Stock Items" action={<ViewAll />}>
                        <table className="w-full text-left">
                            <thead>
                                <tr className="text-[10px] uppercase tracking-wide text-slate-400">
                                    <th className="pb-2 font-medium">#</th>
                                    <th className="pb-2 font-medium">Item</th>
                                    <th className="pb-2 font-medium">Available</th>
                                    <th className="pb-2 font-medium">Reorder</th>
                                    <th className="pb-2 font-medium">UOM</th>
                                    <th className="pb-2 font-medium">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {LOW_STOCK.map((row) => (
                                    <tr key={row.n} className="border-t border-slate-100 text-[11px] text-slate-700">
                                        <td className="py-2 text-slate-400">{row.n}</td>
                                        <td className="py-2 pr-2 font-medium">{row.item}</td>
                                        <td className={`py-2 font-semibold ${row.available === 0 ? 'text-red-500' : 'text-orange-500'}`}>{row.available}</td>
                                        <td className="py-2 text-slate-500">{row.reorder}</td>
                                        <td className="py-2 text-slate-500">{row.uom}</td>
                                        <td className="py-2"><StatusPill status={row.status} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Card>
                    <Card title="Recent Purchases" action={<ViewAll />}>
                        <table className="w-full text-left">
                            <thead>
                                <tr className="text-[10px] uppercase tracking-wide text-slate-400">
                                    <th className="pb-2 font-medium">PO No</th>
                                    <th className="pb-2 font-medium">Vendor</th>
                                    <th className="pb-2 font-medium">Amount</th>
                                    <th className="pb-2 font-medium">Date</th>
                                    <th className="pb-2 font-medium">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {RECENT_PURCHASES.map((row) => (
                                    <tr key={row.po} className="border-t border-slate-100 text-[11px] text-slate-700">
                                        <td className="py-2 font-medium text-slate-800">{row.po}</td>
                                        <td className="py-2 pr-2">{row.vendor}</td>
                                        <td className="py-2">{row.amount}</td>
                                        <td className="py-2 text-slate-500">{row.date}</td>
                                        <td className="py-2"><StatusPill status={row.status} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Card>
                    <Card title="Recent Price Changes" action={<ViewAll />}>
                        <table className="w-full text-left">
                            <thead>
                                <tr className="text-[10px] uppercase tracking-wide text-slate-400">
                                    <th className="pb-2 font-medium">Product</th>
                                    <th className="pb-2 font-medium">Vendor</th>
                                    <th className="pb-2 font-medium">Old Price</th>
                                    <th className="pb-2 font-medium">New Price</th>
                                    <th className="pb-2 font-medium">Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {PRICE_CHANGES.map((row) => (
                                    <tr key={`${row.product}-${row.date}`} className="border-t border-slate-100 text-[11px] text-slate-700">
                                        <td className="py-2 pr-2 font-medium">{row.product}</td>
                                        <td className="py-2 pr-2">{row.vendor}</td>
                                        <td className="py-2 text-slate-500">{row.oldPrice}</td>
                                        <td className={`py-2 font-semibold ${row.up ? 'text-emerald-600' : 'text-red-500'}`}>
                                            <span className="inline-flex items-center gap-0.5">
                                                {row.newPrice}
                                                {row.up ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
                                            </span>
                                        </td>
                                        <td className="py-2 text-slate-500">{row.date}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Card>
                </div>

                <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                    <Card title="Stock by Warehouse">
                        <RechartsBox height={200} minHeight={200}>
                            <BarChart data={WAREHOUSES} barSize={36} margin={{ top: 16, right: 8, left: -18, bottom: 0 }}>
                                <CartesianGrid vertical={false} stroke="#EEF2F7" />
                                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} interval={0} />
                                <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                                <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]}>
                                    <LabelList dataKey="value" position="top" style={{ fontSize: 11, fill: '#334155', fontWeight: 600 }} />
                                </Bar>
                            </BarChart>
                        </RechartsBox>
                    </Card>
                    <Card title="Stock Status Overview">
                        <Donut data={STOCK_STATUS} center="2,458" caption="Items" />
                    </Card>
                    <Card title="Purchase Order Status">
                        <Donut data={PO_STATUS} center="28" caption="Total POs" />
                    </Card>
                </div>
            </main>

            <footer className="flex flex-col gap-1 border-t border-[#E6EDF5] bg-white px-5 py-3 text-[11px] text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                <p>
                    <span className="font-semibold text-blue-700">VEGA</span>
                    {' '}DIGITAL IT SOLUTIONS LLC
                    <span className="mx-2 text-slate-300">|</span>
                    Inventory & Vendor Management System v1.0
                </p>
                <p>Small Business, Big Vision <span className="mx-1 text-slate-300">|</span> Tech Mind, Creative Soul</p>
            </footer>
        </>
    );
}
