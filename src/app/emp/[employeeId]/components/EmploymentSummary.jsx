'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import EmployeeHeroCardBackground from './EmployeeHeroCardBackground';

const AUTO_ADVANCE_MS = 5000;

export default function EmploymentSummary({ statusItems, getStatusColor, activeTab }) {
    const [pageIndex, setPageIndex] = useState(0);
    const [hovered, setHovered] = useState(false);
    const [pageVisible, setPageVisible] = useState(true);

    const pointsPerPage = activeTab === 'salary' ? 6 : 5;
    const pages = useMemo(() => {
        const items = Array.isArray(statusItems) ? statusItems : [];
        if (items.length === 0) return [];
        const out = [];
        for (let i = 0; i < items.length; i += pointsPerPage) {
            out.push(items.slice(i, i + pointsPerPage));
        }
        return out;
    }, [statusItems, pointsPerPage]);

    const hasMultiplePages = pages.length > 1;

    useEffect(() => {
        setPageIndex(0);
    }, [activeTab]);

    useEffect(() => {
        if (pages.length === 0) {
            setPageIndex(0);
            return;
        }
        setPageIndex((prev) => Math.min(prev, pages.length - 1));
    }, [pages.length]);

    const goToPreviousPage = useCallback(() => {
        if (pages.length <= 1) return;
        setPageIndex((prev) => (prev - 1 + pages.length) % pages.length);
    }, [pages.length]);

    const goToNextPage = useCallback(() => {
        if (pages.length <= 1) return;
        setPageIndex((prev) => (prev + 1) % pages.length);
    }, [pages.length]);

    useEffect(() => {
        if (hovered || !hasMultiplePages) return;
        const timer = setInterval(() => {
            setPageIndex((prev) => (prev + 1) % pages.length);
        }, AUTO_ADVANCE_MS);
        return () => clearInterval(timer);
    }, [hovered, hasMultiplePages, pages.length]);

    useEffect(() => {
        if (!hasMultiplePages) return;
        setPageVisible(false);
        const t = setTimeout(() => setPageVisible(true), 40);
        return () => clearTimeout(t);
    }, [pageIndex, hasMultiplePages]);

    const navButtonClass =
        'inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white transition-colors hover:bg-white/25 hover:border-white/50 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white/10';

    return (
        <div className="relative flex h-full flex-col overflow-hidden rounded-2xl text-white shadow-md">
            <EmployeeHeroCardBackground />

            <div
                className="relative z-10 flex flex-1 flex-col p-6"
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
            >
                <h2 className="mb-4 text-2xl font-semibold text-white drop-shadow-sm">
                    {activeTab === 'salary' ? 'Salary Summary' : 'Employment Summary'}
                </h2>
                <div className="flex flex-1 items-stretch gap-4">
                    <div className={`relative flex-shrink-0 ${activeTab === 'salary' ? 'w-[189px]' : 'w-[114px]'} h-[177px]`}>
                        <Image
                            src={activeTab === 'salary' ? '/assets/employee/salary-icon.png' : '/assets/employee/tie-img.png'}
                            alt="Employment Summary"
                            width={activeTab === 'salary' ? 189 : 114}
                            height={177}
                            className="object-contain"
                            loading="lazy"
                            sizes={activeTab === 'salary' ? '189px' : '114px'}
                            quality={85}
                        />
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col justify-between">
                        <div
                            className={`space-y-2 transition-all duration-500 ease-in-out ${
                                pageVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
                            }`}
                        >
                            {pages.length > 0 ? (
                                (pages[pageIndex] || []).map((item, index) => (
                                    <div key={`${item.text}-${index}`} className="flex items-center gap-3">
                                        <div
                                            className={`h-2 w-5 shrink-0 rounded-full ${
                                                item.color || (getStatusColor ? getStatusColor(item.type) : 'bg-gray-400')
                                            }`}
                                        />
                                        <p className="text-sm text-white">{item.text}</p>
                                    </div>
                                ))
                            ) : (
                                <div className="flex items-center gap-3">
                                    <div className="h-2 w-5 rounded-full bg-white/20" />
                                    <p className="text-sm text-white/70">No summary items</p>
                                </div>
                            )}
                        </div>

                        {hasMultiplePages ? (
                            <div className="mt-3 flex items-center justify-center gap-2">
                                {pages.map((_, idx) => (
                                    <button
                                        key={`summary-dot-${idx}`}
                                        type="button"
                                        onClick={() => setPageIndex(idx)}
                                        aria-label={`Go to summary page ${idx + 1}`}
                                        className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${
                                            idx === pageIndex ? 'scale-125 bg-white' : 'bg-white/35 hover:bg-white/60'
                                        }`}
                                    />
                                ))}
                            </div>
                        ) : null}
                    </div>

                    {hasMultiplePages ? (
                        <div className="flex shrink-0 flex-col items-center justify-center gap-2 self-center px-1">
                            <button
                                type="button"
                                onClick={goToPreviousPage}
                                aria-label="Previous summary page"
                                className={navButtonClass}
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-white/80">
                                {pageIndex + 1} / {pages.length}
                            </span>
                            <button
                                type="button"
                                onClick={goToNextPage}
                                aria-label="Next summary page"
                                className={navButtonClass}
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
};
