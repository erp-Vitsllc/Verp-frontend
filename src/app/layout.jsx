import { Inter } from 'next/font/google';
import './globals.css';
import ToasterProvider from '@/components/ToasterProvider';
import AnalyticsWrapper from '@/components/AnalyticsWrapper';

const inter = Inter({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700'],
    variable: '--font-inter',
    display: 'swap'
});

export default function RootLayout({ children }) {
    return (
        <html lang="en" className="overflow-x-hidden max-w-full">
            <body className={`${inter.variable} font-sans antialiased overflow-x-hidden max-w-full`}>
                <div className="w-full max-w-full overflow-x-hidden">
                    {children}
                </div>
                <ToasterProvider />
                <AnalyticsWrapper />
            </body>
        </html>
    );
}
