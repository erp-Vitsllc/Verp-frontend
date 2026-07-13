'use client';

import { Download } from 'lucide-react';

/**
 * Live certificate preview — always built from current reward / signer data.
 */
export default function RewardCertificatePreview({
    headerText = 'Certificate',
    subHeaderText = 'Of Appreciation',
    presentationText = 'This certificate is presented to',
    employeeDisplayName = '',
    title = '',
    rewardType = '',
    giftName = '',
    amount = null,
    currency = 'AED',
    signer1Name = '',
    signer1Title = '',
    signer2Name = '',
    signer2Title = '',
    onDownload,
    downloading = false,
    showDownloadButton = true,
}) {
    const typeLower = String(rewardType || '').toLowerCase();
    const showGift = typeLower.includes('gift') && giftName;
    const showAmount = (typeLower.includes('cash') || typeLower.includes('gift') || typeLower.includes('bonus')) && amount != null && amount !== '';

    return (
        <div className="flex justify-center overflow-auto w-full">
            <div
                id="certificate-container"
                className="bg-white relative w-full max-w-[900px] aspect-[1.414] shadow-2xl overflow-hidden flex flex-col justify-between"
            >
                {showDownloadButton ? (
                    <button
                        type="button"
                        onClick={onDownload}
                        disabled={downloading}
                        className="absolute top-6 right-6 z-50 p-3 bg-white/90 text-gray-700 border border-gray-200/50 rounded-full hover:bg-white hover:text-blue-600 hover:shadow-md transition-all backdrop-blur-sm print:hidden"
                        title="Download PDF"
                        data-html2canvas-ignore="true"
                    >
                        <Download className="w-5 h-5" />
                    </button>
                ) : null}

                <div className="absolute inset-0 z-0">
                    <img
                        src="/assets/certificate-bg-new.png"
                        alt="Certificate Background"
                        className="w-full h-full object-fill"
                        crossOrigin="anonymous"
                    />
                </div>

                <div className="relative z-20 flex-1 flex flex-col items-center justify-center px-16 sm:px-24 pt-20 pb-0 text-center">
                    <h1
                        className="text-3xl sm:text-4xl md:text-5xl font-semibold text-[#1a2e35] tracking-[0.1em] mb-2 uppercase font-sans"
                        style={{ fontFamily: '"Montserrat", sans-serif' }}
                    >
                        {headerText}
                    </h1>
                    <h2
                        className="text-lg sm:text-xl md:text-2xl text-[#1a2e35] font-normal mb-4 tracking-wide"
                        style={{ fontFamily: '"Montserrat", sans-serif' }}
                    >
                        {subHeaderText}
                    </h2>
                    <p
                        className="text-xs text-black uppercase tracking-widest mb-4"
                        style={{ fontFamily: '"Montserrat", sans-serif' }}
                    >
                        {presentationText}
                    </p>
                    <div className="mb-6 w-full px-4 sm:px-10">
                        <h3
                            className="text-3xl sm:text-4xl md:text-5xl text-[#1a2e35] font-normal break-words leading-tight"
                            style={{ fontFamily: '"Great Vibes", cursive' }}
                        >
                            {employeeDisplayName}
                        </h3>
                    </div>
                    <div className="max-w-2xl mx-auto space-y-3">
                        <p
                            className="text-sm md:text-base text-gray-600 leading-relaxed px-4 break-words"
                            style={{ fontFamily: '"Montserrat", sans-serif' }}
                        >
                            {title || ''}
                        </p>
                        <div className="mt-2 space-y-1">
                            {showGift ? (
                                <p
                                    className="text-lg font-medium text-[#1a2e35]"
                                    style={{ fontFamily: '"Montserrat", sans-serif' }}
                                >
                                    Gift: {giftName}
                                </p>
                            ) : null}
                            {showAmount ? (
                                <p
                                    className="text-lg font-medium text-[#1a2e35]"
                                    style={{ fontFamily: '"Montserrat", sans-serif' }}
                                >
                                    Amount: {currency} {Number(amount).toLocaleString()}
                                </p>
                            ) : null}
                        </div>
                    </div>
                </div>

                <div className="relative z-20 flex items-end justify-between px-10 sm:px-24 md:px-36 pb-20 sm:pb-28 w-full">
                    <div className="text-center min-w-0">
                        <p
                            className="text-base sm:text-lg font-semibold text-[#1a2e35] mb-1 truncate"
                            style={{ fontFamily: '"Playfair Display", serif' }}
                        >
                            {signer1Name}
                        </p>
                        <p
                            className="text-sm sm:text-lg font-medium uppercase tracking-wider text-[#1a2e35] truncate"
                            style={{ fontFamily: '"Playfair Display", serif' }}
                        >
                            {signer1Title}
                        </p>
                    </div>
                    <div className="flex items-center justify-center -mb-4 shrink-0">
                        <img
                            src="/assets/certificate-logo-v2.png"
                            alt="Company Seal"
                            className="w-40 h-20 sm:w-60 sm:h-32 object-contain"
                            crossOrigin="anonymous"
                        />
                    </div>
                    <div className="text-center min-w-0">
                        <p
                            className="text-base sm:text-lg font-semibold text-[#1a2e35] mb-1 truncate"
                            style={{ fontFamily: '"Playfair Display", serif' }}
                        >
                            {signer2Name}
                        </p>
                        <p
                            className="text-sm sm:text-lg uppercase tracking-wider text-[#1a2e35] truncate"
                            style={{ fontFamily: '"Playfair Display", serif' }}
                        >
                            {signer2Title}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
