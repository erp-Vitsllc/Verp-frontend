'use client';

import { useCallback, useEffect, useState } from 'react';
import axiosInstance from '@/utils/axios';

export const MAIN_SALARY_POLICY_CHANGED = 'verp:main-salary-policy-changed';

export const MAIN_POLICY_REQUIRED_MESSAGE =
    'Update the main salary policy first before enrolling an employee.';

export function notifyMainSalaryPolicyChanged() {
    if (typeof window === 'undefined') return;
    const event = new CustomEvent(MAIN_SALARY_POLICY_CHANGED);
    window.dispatchEvent(event);
    document.dispatchEvent(event);
}

export function useMainSalaryPolicyConfigured() {
    const [configured, setConfigured] = useState(false);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        try {
            const res = await axiosInstance.get('/Employee/payroll-settings', { skipToast: true });
            setConfigured(Boolean(res.data?.mainPolicyConfigured));
        } catch {
            setConfigured(false);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
        const onChanged = () => refresh();
        if (typeof window !== 'undefined') {
            window.addEventListener(MAIN_SALARY_POLICY_CHANGED, onChanged);
        }
        if (typeof document !== 'undefined') {
            document.addEventListener(MAIN_SALARY_POLICY_CHANGED, onChanged);
        }
        return () => {
            if (typeof window !== 'undefined') {
                window.removeEventListener(MAIN_SALARY_POLICY_CHANGED, onChanged);
            }
            if (typeof document !== 'undefined') {
                document.removeEventListener(MAIN_SALARY_POLICY_CHANGED, onChanged);
            }
        };
    }, [refresh]);

    return { configured, loading, refresh };
}
