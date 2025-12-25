'use client';

import Image from 'next/image';

export default function EmploymentSummary({ statusItems, getStatusColor }) {
    return (
        <div className="relative rounded-lg overflow-hidden shadow-sm text-white">
            <div className="absolute inset-0 bg-gradient-to-r from-sky-500 via-sky-500 to-sky-400"></div>
            <div className="absolute -left-24 -bottom-24 w-64 h-64 bg-blue-700/40 rounded-full"></div>
            <div className="absolute -right-16 -top-16 w-48 h-48 bg-sky-300/30 rounded-full"></div>

            <div className="relative p-6">
                <h2 className="text-2xl font-semibold text-white mb-4">Employment Summary</h2>
                <div className="flex items-start gap-6">
                    {/* Tie Icon Image - Optimized with lazy loading */}
                    <div className="relative flex-shrink-0 w-[114px] h-[177px]">
                        <Image
                            src="/assets/employee/tie-img.png"
                            alt="Employment Summary"
                            width={114}
                            height={177}
                            className="object-contain"
                            loading="lazy"
                            sizes="114px"
                            quality={85}
                        />
                    </div>

                    {/* Status List */}
                    <div className="flex-1 space-y-2">
                        {statusItems.map((item, index) => (
                            <div key={index} className="flex items-center gap-3">
                                <div className={`w-5 h-2 rounded-full ${getStatusColor(item.type)}`} />
                                <p className="text-white text-sm">{item.text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
















