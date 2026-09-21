import Image from 'next/image';
import VerpPrivacyPolicyContent from '@/components/VerpPrivacyPolicyContent';

export const metadata = {
    title: 'VERP Employee Portal Privacy Policy',
    description:
        'Privacy Policy for VERP Employee Portal, the employee HR, attendance, and workplace management application provided by VEGA DIGITAL IT SOLUTIONS LLC. Explains how employee information is collected, used, stored, and protected.',
    robots: 'index, follow',
};

export default function PrivacyPolicyPage() {
    return (
        <main className="min-h-screen bg-[#F2F6F9] text-gray-800">
            <header className="border-b border-gray-200 bg-white">
                <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4 md:px-8">
                    <Image
                        src="/assets/auth/verp-logo-3.png"
                        alt="VERP"
                        width={160}
                        height={48}
                        priority
                        className="h-10 w-auto md:h-12"
                    />
                    <span className="text-xs font-medium uppercase tracking-[0.16em] text-gray-400 md:text-sm">
                        Employee Portal
                    </span>
                </div>
            </header>

            <div className="mx-auto max-w-3xl px-5 py-10 md:px-8 md:py-14">
                <VerpPrivacyPolicyContent />
            </div>
        </main>
    );
}
