'use client';

import { useState } from 'react';
import HrHolidaysPanel from './HrHolidaysPanel';
import HrWorkingTimePanel from './HrWorkingTimePanel';

const HR_SUB_TABS = [
    { id: 'holidays', label: 'Holidays' },
    { id: 'workingTime', label: 'Working Time' },
];

export default function HrPanel() {
    const [hrSubTab, setHrSubTab] = useState('holidays');

    return (
        <div className="flex flex-col gap-4 sm:gap-5">
            <div className="flex items-center gap-2 sm:gap-3 bg-white p-1 sm:p-1.5 rounded-xl sm:rounded-2xl shadow-sm border border-slate-100 w-full sm:w-fit overflow-x-auto">
                {HR_SUB_TABS.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setHrSubTab(tab.id)}
                        className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-black transition-all duration-300 whitespace-nowrap ${
                            hrSubTab === tab.id
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                                : 'text-slate-500 hover:text-blue-600 hover:bg-slate-50'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {hrSubTab === 'holidays' ? <HrHolidaysPanel /> : <HrWorkingTimePanel />}
        </div>
    );
}
