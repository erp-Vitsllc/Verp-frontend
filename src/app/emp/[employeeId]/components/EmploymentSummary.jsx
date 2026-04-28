'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';

export default function EmploymentSummary({ statusItems, getStatusColor, activeTab }) {
    const [pageIndex, setPageIndex] = useState(0);
    const [hovered, setHovered] = useState(false);
    const [pageVisible, setPageVisible] = useState(true);

    const POINTS_PER_PAGE = 5;
    const pages = useMemo(() => {
        const items = Array.isArray(statusItems) ? statusItems : [];
        if (items.length === 0) return [];
        const out = [];
        for (let i = 0; i < items.length; i += POINTS_PER_PAGE) {
            out.push(items.slice(i, i + POINTS_PER_PAGE));
        }
        return out;
    }, [statusItems]);

    useEffect(() => {
        if (pages.length === 0) {
            setPageIndex(0);
            return;
        }
        setPageIndex((prev) => Math.min(prev, pages.length - 1));
    }, [pages.length]);

    useEffect(() => {
        if (hovered || pages.length <= 1) return;
        const timer = setInterval(() => {
            setPageIndex((prev) => (prev + 1) % pages.length);
        }, 5000);
        return () => clearInterval(timer);
    }, [hovered, pages.length]);

    useEffect(() => {
        if (pages.length <= 1) return;
        setPageVisible(false);
        const t = setTimeout(() => setPageVisible(true), 40);
        return () => clearTimeout(t);
    }, [pageIndex, pages.length]);

    return (
        <div className="relative rounded-xl overflow-hidden shadow-sm text-white flex flex-col h-full">
            <div className="absolute inset-0 bg-gradient-to-r from-sky-500 via-sky-500 to-sky-400"></div>
            <div className="absolute -left-24 -bottom-24 w-64 h-64 bg-blue-700/40 rounded-full"></div>
            <div className="absolute -right-16 -top-16 w-48 h-48 bg-sky-300/30 rounded-full"></div>

            <div className="relative p-6 flex-1 flex flex-col">
                <h2 className="text-2xl font-semibold text-white mb-4">{activeTab === 'salary' ? 'Salary Summary' : 'Employment Summary'}</h2>
                <div className="flex items-start gap-6 flex-1">
                    {/* Icon Image - Optimized with lazy loading */}
                    <div className={`relative flex-shrink-0 ${activeTab === 'salary' ? 'w-[189px]' : 'w-[114px]'} h-[177px]`}>
                        <Image
                            src={activeTab === 'salary' ? "/assets/employee/salary-icon.png" : "/assets/employee/tie-img.png"}
                            alt="Employment Summary"
                            width={activeTab === 'salary' ? 189 : 114}
                            height={177}
                            className="object-contain"
                            loading="lazy"
                            sizes={activeTab === 'salary' ? "189px" : "114px"}
                            quality={85}
                        />
                    </div>

                    {/* Status List */}
                    <div
                        className="flex-1"
                        onMouseEnter={() => setHovered(true)}
                        onMouseLeave={() => setHovered(false)}
                    >
                        <div
                            className={`space-y-2 transition-all duration-500 ease-in-out ${
                                pageVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
                            }`}
                        >
                            {pages.length > 0 ? (
                                (pages[pageIndex] || []).map((item, index) => (
                                    <div key={`${item.text}-${index}`} className="flex items-center gap-3">
                                        <div
                                            className={`w-5 h-2 rounded-full ${
                                                item.color || (getStatusColor ? getStatusColor(item.type) : 'bg-gray-400')
                                            }`}
                                        />
                                        <p className="text-white text-sm">{item.text}</p>
                                    </div>
                                ))
                            ) : (
                                <div className="flex items-center gap-3">
                                    <div className="w-5 h-2 rounded-full bg-white/20" />
                                    <p className="text-white/70 text-sm">No summary items</p>
                                </div>
                            )}
                        </div>

                        {pages.length > 1 ? (
                            <div className="mt-3 flex items-center justify-center gap-2">
                                {pages.map((_, idx) => (
                                    <button
                                        key={`summary-dot-${idx}`}
                                        type="button"
                                        onClick={() => setPageIndex(idx)}
                                        aria-label={`Go to summary page ${idx + 1}`}
                                        className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${
                                            idx === pageIndex ? 'bg-white scale-125' : 'bg-sky-200/80 hover:bg-sky-100'
                                        }`}
                                    />
                                ))}
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
}
















