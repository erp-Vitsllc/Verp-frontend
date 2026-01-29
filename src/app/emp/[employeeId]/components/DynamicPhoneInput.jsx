'use client';

import dynamic from 'next/dynamic';

const PhoneInputField = dynamic(() => import('@/components/ui/phone-input'), {
    ssr: false,
    loading: () => <div className="h-11 w-full bg-gray-50 border border-gray-300 rounded-lg animate-pulse" />
});

/**
 * Dynamic Phone Input Component wrapper
 * Now uses the centralized PhoneInputField for better validation and UI
 */
export default function DynamicPhoneInput(props) {
    return <PhoneInputField {...props} />;
}




