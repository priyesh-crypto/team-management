"use client";
import React from 'react';
import { cn } from '@/lib/utils';
import { motion, HTMLMotionProps } from 'framer-motion';

export function Card({ className, children, hover = false, glass = false }: { className?: string, children: React.ReactNode, hover?: boolean, glass?: boolean }) {
    return (
        <motion.div 
            whileHover={hover ? { y: -4, boxShadow: "0 20px 40px rgba(0,0,0,0.06)" } : {}}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            className={cn(
                "rounded-[28px] border transition-all duration-500",
                glass 
                    ? "bg-white/70 backdrop-blur-2xl border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.02)]" 
                    : "bg-white border-slate-100/80 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.02)]",
                className
            )}
        >
            {children}
        </motion.div>
    );
}

export function Button({
    className,
    variant = 'primary',
    ...props
}: HTMLMotionProps<"button"> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }) {
    const variants = {
        primary: "bg-gradient-to-b from-[#0071e3] to-[#0066cc] hover:from-[#0077ED] hover:to-[#0071e3] text-white shadow-[0_4px_12px_rgba(0,113,227,0.15)]",
        secondary: "bg-white hover:bg-slate-50 text-slate-900 border border-slate-100 shadow-sm",
        danger: "bg-gradient-to-b from-[#ff3b30] to-[#e03126] hover:from-[#ff453a] hover:to-[#ff3b30] text-white shadow-[0_4px_12px_rgba(255,59,48,0.15)]",
        ghost: "bg-transparent hover:bg-slate-50 text-slate-400 hover:text-slate-900"
    };

    return (
        <motion.button
            whileTap={{ scale: 0.98 }}
            className={cn(
                "px-6 py-3 rounded-2xl font-bold text-[10px] uppercase tracking-[0.18em] transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed",
                variants[variant],
                className
            )}
            {...props}
        />
    );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement>) {
    return (
        <input
            className={cn(
                "bg-slate-50/50 border border-slate-100 text-slate-900 rounded-xl px-5 py-3 outline-none transition-all duration-300 focus:bg-white focus:border-[#0071e3]/30 focus:ring-4 focus:ring-[#0071e3]/5 placeholder-slate-400 font-medium text-[13px]",
                className
            )}
            {...props}
        />
    );
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
    return (
        <div className="relative group">
            <select
                className={cn(
                    "w-full bg-slate-50/50 border border-slate-100 text-slate-900 rounded-xl px-5 py-3 outline-none transition-all duration-300 focus:bg-white focus:border-[#0071e3]/30 focus:ring-4 focus:ring-[#0071e3]/5 appearance-none font-bold text-[9px] uppercase tracking-widest cursor-pointer",
                    className
                )}
                {...props}
            >
                {children}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-[#0071e3] transition-colors">
                <svg width="8" height="5" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
            </div>
        </div>
    );
}

export function Badge({ children, variant = 'default', className }: { children: React.ReactNode, variant?: string, className?: string }) {
    const variants: Record<string, string> = {
        Urgent: "bg-rose-50 text-rose-500 border-rose-100",
        High: "bg-orange-50 text-orange-500 border-orange-100",
        Medium: "bg-blue-50 text-blue-500 border-blue-100",
        Low: "bg-emerald-50 text-emerald-500 border-emerald-100",
        default: "bg-slate-50 text-slate-400 border-slate-100"
    };

    return (
        <span className={cn(
            "px-2.5 py-1 rounded-lg text-[8px] font-bold uppercase tracking-widest border transition-all duration-300", 
            variants[variant] || variants.default, 
            className
        )}>
            {children}
        </span>
    );
}

export function CircularProgress({ percentage, color = '#0071e3', size = 100, strokeWidth = 8 }: { percentage: number, color?: string, size?: number, strokeWidth?: number }) {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (percentage / 100) * circumference;

    return (
        <div className="relative flex items-center justify-center p-2" style={{ width: size + 20, height: size + 20 }}>
            {/* Background Glow */}
            <div 
                className="absolute inset-0 rounded-full blur-2xl opacity-10"
                style={{ backgroundColor: color }}
            />
            
            <svg className="transform -rotate-90 relative z-10" width={size} height={size}>
                {/* Track */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="#f5f5f7"
                    strokeWidth={strokeWidth}
                    fill="transparent"
                />
                {/* Progress */}
                <motion.circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={color}
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: offset }}
                    transition={{ duration: 1.5, ease: [0.23, 1, 0.32, 1] }}
                    strokeLinecap="round"
                />
            </svg>
            
            <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
                <span className="text-xl font-black text-[#1d1d1f] tracking-tighter">
                    {Math.round(percentage)}%
                </span>
                <span className="text-[8px] font-black text-[#86868b] uppercase tracking-widest mt-[-2px]">
                    Efficiency
                </span>
            </div>
        </div>
    );
}
