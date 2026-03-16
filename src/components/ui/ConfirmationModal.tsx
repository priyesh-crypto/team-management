'use client'
import React from 'react';
import { Card, Button } from './components';
import { Trash2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: string | React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning';
    isLoading?: boolean;
}

export function ConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'danger',
    isLoading = false
}: ConfirmationModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <div 
                className="absolute inset-0 bg-black/40 backdrop-blur-md transition-opacity animate-in fade-in duration-300"
                onClick={onClose}
            />
            <Card className="relative w-full max-w-[400px] p-8 shadow-[0_32px_64px_rgba(0,0,0,0.3)] border-none bg-white rounded-3xl animate-in zoom-in-95 duration-200">
                <div className="flex flex-col items-center text-center">
                    <div className={cn(
                        "w-16 h-16 rounded-2xl flex items-center justify-center mb-6",
                        variant === 'danger' ? "bg-[#ff3b30]/10" : "bg-orange-100"
                    )}>
                        {variant === 'danger' ? (
                            <Trash2 size={28} color="#ff3b30" strokeWidth={2.5} />
                        ) : (
                            <AlertCircle size={28} className="text-orange-500" strokeWidth={2.5} />
                        )}
                    </div>
                    
                    <h3 className="text-[11px] font-black text-[#1d1d1f] tracking-[0.2em] uppercase mb-3">
                        {title}
                    </h3>
                    
                    <div className="text-[14px] text-[#86868b] font-medium leading-relaxed mb-8">
                        {description}
                    </div>

                    <div className="grid grid-cols-2 gap-4 w-full">
                        <Button 
                            variant="secondary" 
                            className="h-12 rounded-2xl font-black text-[10px] uppercase tracking-widest border-[#e5e5ea] hover:bg-[#f5f5f7] text-[#86868b]"
                            onClick={onClose}
                            disabled={isLoading}
                        >
                            {cancelText}
                        </Button>
                        <Button 
                            variant={variant === 'danger' ? 'danger' : 'primary'}
                            className={cn(
                                "h-12 rounded-2xl font-black text-[10px] uppercase tracking-widest border-none shadow-lg",
                                variant === 'danger' ? "bg-[#ff3b30] hover:bg-[#e03126] shadow-[#ff3b30]/20" : ""
                            )}
                            onClick={onConfirm}
                            disabled={isLoading}
                        >
                            {isLoading ? 'Processing...' : confirmText}
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
}
