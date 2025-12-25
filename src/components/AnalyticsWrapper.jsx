'use client';

import dynamic from 'next/dynamic';

// Conditionally load Analytics only in production and on Vercel
const Analytics = dynamic(
    () => import('@vercel/analytics/next').then((mod) => mod.Analytics),
    {
        ssr: false, // Only load on client
    }
);

export default function AnalyticsWrapper() {
    // Check if we're on Vercel or in production (client-side check)
    if (typeof window === 'undefined') {
        return null; // Don't render on server
    }
    
    const isVercel = process.env.NEXT_PUBLIC_VERCEL === '1' || 
                     (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app'));
    const isProduction = process.env.NODE_ENV === 'production';
    const shouldLoadAnalytics = isVercel && isProduction;
    
    if (!shouldLoadAnalytics) {
        return null;
    }
    
    return <Analytics />;
}

