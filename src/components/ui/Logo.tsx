import React from 'react';

export default function Logo({ className = "", showText = true }: { className?: string, showText?: boolean }) {
    return (
        <div className={`flex flex-col items-center ${className}`}>
            <div className="relative w-12 h-12 flex items-center justify-center">
                <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-sm">
                    {/* Main body / Wing */}
                    <path
                        d="M20 70 L50 20 L80 70 L50 60 Z"
                        fill="url(#logoGradient)"
                        className="opacity-90"
                    />
                    {/* Internal fold */}
                    <path
                        d="M50 20 L65 55 L50 60 Z"
                        fill="rgba(255,255,255,0.2)"
                    />
                    {/* Head detail */}
                    <path
                        d="M80 70 L90 55 L80 60 Z"
                        fill="#14B8A6"
                    />

                    <defs>
                        <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#0ea5e9" />
                            <stop offset="100%" stopColor="#14b8a6" />
                        </linearGradient>
                    </defs>
                </svg>
            </div>
            {showText && (
                <div className="flex flex-col items-center -mt-1">
                    <span className="text-xl font-bold tracking-tight text-[#1d1d1f]">mindbird.ai</span>
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#86868b]">Team Management</span>
                </div>
            )}
        </div>
    );
}
