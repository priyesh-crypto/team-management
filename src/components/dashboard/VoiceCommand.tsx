"use client";

import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Sparkles, X, Send, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onCommand: (text: string) => Promise<void>;
}

export function VoiceCommandModal({ isOpen, onClose, onCommand }: Props) {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [recognition, setRecognition] = useState<any>(null);
    const [permissionError, setPermissionError] = useState(false);
    const [errorCode, setErrorCode] = useState<string | null>(null);
    const [lastAction, setLastAction] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) {
            setIsListening(false);
            setTranscript("");
            setLastAction(null);
            setPermissionError(false);
            setErrorCode(null);
            return;
        }

        if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'speechRecognition' in window)) {
            const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).speechRecognition;
            const rec = new SpeechRecognition();
            rec.continuous = true;
            rec.interimResults = true;
            rec.lang = 'en-US';

            rec.onresult = (event: any) => {
                let current = "";
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    current += event.results[i][0].transcript;
                }
                setTranscript(current);
                setErrorCode(null);
            };

            rec.onerror = (event: any) => {
                console.warn("Speech Error:", event.error);
                setIsListening(false);
                setErrorCode(event.error);
                
                if (event.error === 'not-allowed') setPermissionError(true);
                console.warn("Speech Error:", event.error);
            };

            rec.onend = () => setIsListening(false);
            setRecognition(rec);
            
            // AUTOMATICALLY START LISTENING ON OPEN (Safely)
            const autoStartTimeout = setTimeout(() => {
                try {
                    // Only start if not already active
                    if (rec && !isListening) {
                        rec.start();
                        setIsListening(true);
                    }
                } catch (err) {
                    // Fail silently if already started or blocked
                }
            }, 600);
            
            return () => { 
                clearTimeout(autoStartTimeout);
                try { rec.stop(); } catch(e) {} 
            };
        }
    }, [isOpen]);

    const toggleListening = (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setPermissionError(false);
        if (isListening) {
            recognition?.stop();
            setIsListening(false);
        } else {
            setTranscript("");
            setLastAction(null);
            try {
                recognition?.start();
                setIsListening(true);
            } catch (err) {
                console.error("Failed to start", err);
            }
        }
    };

    const handleSend = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!transcript.trim()) return;
        setIsProcessing(true);
        try {
            await onCommand(transcript);
            setLastAction(`Success!`);
            setTranscript("");
            setTimeout(onClose, 1200);
        } catch (err) {
            toast.error("Failed to process command");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleClose = () => {
        try { recognition?.stop(); } catch(e) {}
        setIsListening(false);
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={handleClose}
                        className="absolute inset-0 bg-black/70 backdrop-blur-md"
                    />
                    
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9, y: 30 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 30 }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white w-full max-w-md rounded-[40px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] overflow-hidden relative z-[10000] border border-white/20"
                    >
                        <div className="p-10 flex flex-col items-center gap-8">
                            {/* Header */}
                            <div className="w-full flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-[#0051e6]/10 flex items-center justify-center text-[#0051e6]">
                                        <Sparkles size={20} />
                                    </div>
                                    <h3 className="text-xs font-black uppercase tracking-widest text-[#1d1d1f]">AI Command Center</h3>
                                </div>
                                <button onClick={handleClose} className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Mic Area */}
                            <div className="relative h-40 flex items-center justify-center">
                                {isListening && (
                                    <motion.div 
                                        animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0.1, 0.4] }}
                                        transition={{ repeat: Infinity, duration: 2 }}
                                        className="absolute w-32 h-32 bg-[#0051e6]/20 rounded-full blur-xl"
                                    />
                                )}
                                <button 
                                    onClick={toggleListening}
                                    className={`relative w-28 h-28 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 z-10 ${isListening ? 'bg-red-500 scale-110' : 'bg-[#0051e6] hover:scale-105'}`}
                                >
                                    {isListening ? <MicOff size={40} className="text-white" /> : <Mic size={40} className="text-white" />}
                                </button>
                            </div>

                                {/* Transcript / Text Input Area */}
                                <div className="text-center w-full min-h-[120px] flex flex-col justify-center gap-4">
                                    {lastAction ? (
                                        <div className="text-green-500 flex flex-col items-center gap-2">
                                            <CheckCircle2 size={32} />
                                            <span className="text-xs font-black uppercase tracking-widest">{lastAction}</span>
                                        </div>
                                    ) : (
                                        <div className="w-full space-y-4 px-4">
                                            {permissionError && (
                                                <div className="bg-red-50 rounded-2xl p-3 border border-red-100 mb-2">
                                                    <div className="flex items-center gap-2 text-red-600 mb-1 justify-center">
                                                        <AlertCircle size={14} />
                                                        <span className="text-[10px] font-black uppercase">Browser Mic Locked</span>
                                                    </div>
                                                    <p className="text-[9px] text-red-500 font-bold leading-tight">
                                                        Please check <b>System Settings &gt; Privacy &gt; Microphone</b> on your Mac.
                                                    </p>
                                                </div>
                                            )}

                                            {isListening ? (
                                                <div className="space-y-2">
                                                    <p className="text-[10px] font-black text-[#0051e6] uppercase tracking-widest animate-pulse">Assistant is Listening...</p>
                                                    <p className="text-lg font-bold text-slate-900 italic line-clamp-2 px-4 leading-tight">
                                                        {transcript || "Dictate your command..."}
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="w-full space-y-3">
                                                    <div className="relative group">
                                                        <input 
                                                            type="text"
                                                            placeholder="Type command (e.g. 'Assign to Sarah')..."
                                                            value={transcript}
                                                            onChange={(e) => {
                                                                setTranscript(e.target.value);
                                                                if (permissionError) setPermissionError(false);
                                                            }}
                                                            className="w-full h-14 bg-slate-50 border-2 border-transparent focus:border-[#0051e6]/10 rounded-2xl px-5 text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:ring-4 focus:ring-[#0051e6]/5 transition-all outline-none"
                                                        />
                                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                            <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest bg-white px-2 py-1 rounded-md border border-slate-100">Keyboard Mode</span>
                                                        </div>
                                                    </div>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                                        Or click the mic to try voice again
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                            {/* Actions */}
                            <div className="w-full grid grid-cols-2 gap-4">
                                <button onClick={handleClose} className="h-14 rounded-2xl bg-slate-50 text-slate-500 text-[11px] font-black uppercase tracking-widest hover:bg-slate-100 transition-colors">
                                    Cancel
                                </button>
                                <button 
                                    disabled={!transcript || isProcessing || isListening}
                                    onClick={handleSend}
                                    className="h-14 rounded-2xl bg-[#0051e6] text-white text-[11px] font-black uppercase tracking-widest hover:bg-[#005bb7] transition-all disabled:opacity-20 flex items-center justify-center gap-2"
                                >
                                    {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                                    {isListening ? "Listening..." : "Execute"}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
