import React from 'react';

export default function Logo({ className = "" }: { className?: string }) {
    return (
        <div className={`flex flex-col items-center ${className}`}>
             <img 
                src="/logo2.avif" 
                alt="Mindbird Logo" 
                className="w-48 h-auto object-contain drop-shadow-sm"
            />
        </div>
    );
}
