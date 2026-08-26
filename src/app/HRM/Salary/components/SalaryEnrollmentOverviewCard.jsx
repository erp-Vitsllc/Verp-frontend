'use client';

import { HEADER_PAIR_CARD_DASHBOARD, HEADER_PAIR_CARD_PADDING } from '@/utils/headerPairLayout';

const COLS = 4;
const ROWS = 2;
const MAX_BOXES = COLS * ROWS;

function EnrollmentBox({ company }) {
    if (!company) {
        return (
            <div
                className="min-w-0 h-full rounded-lg border border-dashed border-gray-200 bg-gray-50/80"
                aria-hidden="true"
            />
        );
    }

    const enrolled = Number(company.enrolled) || 0;
    const total = Number(company.totalActive) || 0;

    return (
        <div className="min-w-0 h-full rounded-lg border border-gray-100 bg-gray-50 px-1.5 sm:px-2 py-2 flex flex-col items-center justify-center text-center overflow-hidden">
            <span className="text-[8px] sm:text-[10px] font-bold text-gray-500 uppercase tracking-wide leading-tight w-full px-0.5 line-clamp-2">
                {company.name}
            </span>
            <span className="mt-1 tabular-nums font-black text-[#0f766e] leading-none whitespace-nowrap text-sm sm:text-base lg:text-lg">
                {enrolled}
                <span className="text-slate-400 font-semibold"> / {total}</span>
            </span>
            <span className="mt-0.5 text-[8px] sm:text-[9px] font-semibold text-slate-400 uppercase tracking-wide">
                Enrolled / Active
            </span>
        </div>
    );
}

export default function SalaryEnrollmentOverviewCard({ overview }) {
    const companies = Array.isArray(overview?.companies) ? overview.companies : [];
    const boxes = [...companies.slice(0, MAX_BOXES)];
    while (boxes.length < MAX_BOXES) boxes.push(null);

    return (
        <div
            className={`bg-white rounded-xl shadow-sm border border-gray-100 ${HEADER_PAIR_CARD_PADDING} ${HEADER_PAIR_CARD_DASHBOARD}`}
        >
            <div className="grid grid-cols-4 grid-rows-2 gap-2 sm:gap-3 flex-1 min-h-0">
                {boxes.map((company, index) => (
                    <EnrollmentBox key={company?.companyId || `empty-${index}`} company={company} />
                ))}
            </div>
        </div>
    );
}
