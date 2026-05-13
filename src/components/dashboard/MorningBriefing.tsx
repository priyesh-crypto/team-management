"use client";

import React, { useState, useEffect } from 'react';
import { 
    Sparkles, 
    AlertCircle, 
    CheckCircle2, 
    TrendingUp, 
    Zap, 
    ArrowRight,
    Loader2,
    Calendar,
    ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MorningBriefing, BriefingSection } from '@/app/actions/briefing';

interface Props {
    briefing: MorningBriefing | null;
    loading: boolean;
    onAction: (type: string, metadata?: any) => void;
}

export function MorningBriefingWidget({ briefing, loading, onAction }: Props) {
    if (loading) {
        return (
            <div className="bg-white rounded-[32px] p-8 border border-slate-200 shadow-xl flex flex-col items-center justify-center min-h-[300px]">
                <Loader2 size={32} className="text-[#0051e6] animate-spin mb-4" />
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Generating AI Briefing...</p>
            </div>
        );
    }

    if (!briefing) return null;

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-[40px] border border-slate-200 shadow-2xl overflow-hidden"
        >
            {/* Hero Section */}
            <div className="bg-[#1d1d1f] p-8 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <Zap size={120} />
                </div>
                
                <div className="relative z-10 space-y-4">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-[#0051e6] flex items-center justify-center">
                            <Sparkles size={16} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">Morning Intelligence Brief</span>
                    </div>
                    
                    <h2 className="text-3xl font-black tracking-tight leading-tight max-w-xl">
                        {briefing.summary}
                    </h2>
                    
                    <div className="flex items-center gap-4 text-[10px] font-bold text-white/60">
                        <div className="flex items-center gap-1.5">
                            <Calendar size={12} />
                            {briefing.date}
                        </div>
                        <span className="opacity-30">•</span>
                        <div className="flex items-center gap-1.5">
                            <Zap size={12} />
                            {briefing.sections.length} Critical Signals
                        </div>
                    </div>
                </div>
            </div>

            {/* Signals Grid */}
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                {briefing.sections.map((section, idx) => (
                    <motion.div 
                        key={idx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className={`p-6 rounded-[28px] border transition-all hover:scale-[1.02] ${
                            section.priority === 'high' ? 'bg-red-50/50 border-red-100' :
                            section.priority === 'medium' ? 'bg-amber-50/50 border-amber-100' :
                            'bg-slate-50 border-slate-100'
                        }`}
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                                section.type === 'alert' ? 'bg-red-100 text-red-600' :
                                section.type === 'success' ? 'bg-emerald-100 text-emerald-600' :
                                section.type === 'bottleneck' ? 'bg-amber-100 text-amber-600' :
                                'bg-blue-100 text-blue-600'
                            }`}>
                                {section.type === 'alert' ? <AlertCircle size={20} /> : 
                                 section.type === 'success' ? <CheckCircle2 size={20} /> : 
                                 section.type === 'bottleneck' ? <Zap size={20} /> : <TrendingUp size={20} />}
                            </div>
                            <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${
                                section.priority === 'high' ? 'bg-red-100 text-red-700' :
                                section.priority === 'medium' ? 'bg-amber-100 text-amber-700' :
                                'bg-slate-200 text-slate-600'
                            }`}>
                                {section.priority} Priority
                            </span>
                        </div>
                        
                        <h4 className="text-sm font-black text-[#1d1d1f] mb-1">{section.title}</h4>
                        <p className="text-[11px] font-medium text-slate-500 leading-relaxed mb-4">
                            {section.description}
                        </p>
                        
                        <button 
                            onClick={() => onAction(section.type, section.metadata)}
                            className="flex items-center gap-2 text-[10px] font-black text-[#0051e6] uppercase tracking-widest hover:gap-3 transition-all"
                        >
                            Take Action <ChevronRight size={12} />
                        </button>
                    </motion.div>
                ))}
            </div>

            {/* Quick Action Footer */}
            <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">AI Command Suggestions:</p>
                <div className="flex items-center gap-3">
                    <button className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-[9px] font-black uppercase tracking-widest hover:border-[#0051e6] transition-all">
                        Reschedule Overdue
                    </button>
                    <button className="px-4 py-2 rounded-xl bg-[#0051e6] text-white text-[9px] font-black uppercase tracking-widest shadow-lg shadow-[#0051e6]/20">
                        View Team Capacity
                    </button>
                </div>
            </div>
        </motion.div>
    );
}
