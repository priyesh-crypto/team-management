import React from 'react';

export default function Logo({ className = "" }: { className?: string }) {
    return (
        <div className={`flex flex-col items-center ${className}`}>
             <img 
                src="/knotlessai.svg" 
                alt="Knotless Logo" 
                className="w-72 h-auto object-contain drop-shadow-md"
            />
        </div>
    );
}
