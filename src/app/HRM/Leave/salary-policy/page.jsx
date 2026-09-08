'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LeaveSalaryPolicyRedirect() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/HRM/Salary/salary-policy');
    }, [router]);

    return null;
}
