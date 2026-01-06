'use client';

import PhoneInputField from '@/components/ui/phone-input';

/**
 * Dynamic Phone Input Component wrapper
 * Now uses the centralized PhoneInputField for better validation and UI
 */
export default function DynamicPhoneInput(props) {
    return <PhoneInputField {...props} />;
}




