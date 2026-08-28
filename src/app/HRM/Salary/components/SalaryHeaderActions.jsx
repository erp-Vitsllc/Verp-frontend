'use client';

import { Wallet } from 'lucide-react';
import NavButton from '@/components/NavButton';

const ENROLL_CLASS =
    'bg-white hover:bg-slate-50 text-slate-700 px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg font-medium inline-flex items-center gap-1.5 sm:gap-2 transition-colors shadow-sm text-xs sm:text-sm whitespace-nowrap border border-gray-800/20 no-underline';

const POLICY_CLASS =
    'bg-teal-500 hover:bg-teal-600 text-white px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg font-medium inline-flex items-center gap-1.5 sm:gap-2 transition-colors shadow-sm text-xs sm:text-sm whitespace-nowrap no-underline';

export default function SalaryHeaderActions({ enrollLabel = 'Salary Enrollment' }) {
    return (
        <>
            <NavButton href="/HRM/Salary/enroll" className={ENROLL_CLASS}>
                {enrollLabel}
            </NavButton>
            <NavButton href="/HRM/Salary/payment" className={ENROLL_CLASS}>
                Salary Payment
            </NavButton>
            <NavButton href="/HRM/Salary/salary-policy" className={POLICY_CLASS}>
                <Wallet size={18} />
                Salary Policy
            </NavButton>
        </>
    );
}
