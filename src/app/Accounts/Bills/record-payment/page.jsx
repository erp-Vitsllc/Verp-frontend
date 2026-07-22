'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * Legacy URL — Difference Pay now uses Accounts → Payments Made → Add.
 * Keep this route as a thin redirect so old links still work.
 */
function RedirectToPaymentsMade() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const params = new URLSearchParams();
        params.set('addUtilityPay', '1');
        params.set('mode', searchParams.get('mode') || 'difference');

        const map = [
            ['billIds', 'billIds'],
            ['billId', 'billIds'],
            ['utilityBillIds', 'utilityBillIds'],
            ['utilityBillId', 'utilityBillIds'],
            ['organizationId', 'organizationId'],
            ['amount', 'amount'],
            ['employeeId', 'employeeId'],
            ['vendorId', 'vendorId'],
            ['vendorName', 'vendorName'],
            ['batchId', 'batchId'],
            ['utilityType', 'utilityType'],
            ['billMonth', 'billMonth'],
            ['returnTo', 'returnTo'],
        ];
        for (const [from, to] of map) {
            const value = searchParams.get(from);
            if (value && !params.get(to)) params.set(to, value);
        }

        // Prefer the shared Payments Made prefill key if the old key is still present.
        try {
            const legacy = sessionStorage.getItem('utilityDifferenceRecordPaymentPrefill');
            if (legacy) {
                const parsed = JSON.parse(legacy);
                const partyId = String(parsed?.partyAccountId || '').trim();
                sessionStorage.setItem(
                    'utilityVendorPaymentPrefill',
                    JSON.stringify({
                        ...parsed,
                        mode: 'difference',
                        billsOnly: true,
                        paidThroughAccountId:
                            parsed?.paidThroughAccountId || partyId || '',
                        paidThroughAccountName:
                            parsed?.paidThroughAccountName || parsed?.partyAccountName || '',
                        zohoBillIds: parsed?.selectedBillIds || parsed?.zohoBillIds || [],
                        selectedBillIds: parsed?.selectedBillIds || parsed?.zohoBillIds || [],
                    }),
                );
                sessionStorage.removeItem('utilityDifferenceRecordPaymentPrefill');
            }
        } catch {
            /* ignore */
        }

        router.replace(`/Accounts/PaymentsMade/new?${params.toString()}`);
    }, [router, searchParams]);

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#f4f6f8] text-sm text-slate-500">
            Opening Payments Made…
        </div>
    );
}

export default function RecordBillPaymentRedirectPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-screen items-center justify-center bg-[#f4f6f8] text-sm text-slate-500">
                    Opening Payments Made…
                </div>
            }
        >
            <RedirectToPaymentsMade />
        </Suspense>
    );
}
