import { Inter } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';
import ToasterProvider from '@/components/ToasterProvider';

const inter = Inter({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700'],
    variable: '--font-inter',
    display: 'swap'
});


export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <body className={`${inter.variable} font-sans antialiased`}>
                {children}
                <ToasterProvider />
                <Analytics />
            </body>
        </html>
    );
}
