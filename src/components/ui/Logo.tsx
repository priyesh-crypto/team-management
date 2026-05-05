import React from 'react';
import Image from 'next/image';

export default function Logo({ className = "" }: { className?: string }) {
    return (
        <div className={`flex flex-col items-center ${className}`}>
             <Image 
                src="/knotlessai.svg" 
                alt="Knotless Logo" 
                width={288}
                height={144}
                priority
                className="w-72 h-auto object-contain drop-shadow-md"
            />
        </div>
    );
}

