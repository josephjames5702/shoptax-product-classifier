import React from 'react';

interface ShopTaxIconProps {
  className?: string;
  size?: number;
}

export const ShopTaxIcon: React.FC<ShopTaxIconProps> = ({
  className = 'w-7 h-7',
  size = 28,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Central trunk */}
      <path d="M18 32V16" stroke="#334155" strokeWidth="2.2" strokeLinecap="round" />
      {/* Base roots */}
      <path d="M18 32L14 34.5" stroke="#64748b" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M18 32L22 34.5" stroke="#64748b" strokeWidth="1.8" strokeLinecap="round" />
      {/* Left primary branch */}
      <path d="M18 24C14 24 11 20 11 16" stroke="#475569" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M14 20C11 18 8 15 8 11" stroke="#475569" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M11 16C11 12 13 8 16 6" stroke="#475569" strokeWidth="1.8" strokeLinecap="round" />
      {/* Right primary branch */}
      <path d="M18 24C22 24 25 20 25 16" stroke="#475569" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M22 20C25 18 28 15 28 11" stroke="#475569" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M25 16C25 12 23 8 20 6" stroke="#475569" strokeWidth="1.8" strokeLinecap="round" />
      {/* Center top stem */}
      <path d="M18 16V5" stroke="#475569" strokeWidth="1.8" strokeLinecap="round" />

      {/* Nodes / circles */}
      <circle cx="18" cy="4" r="2.2" fill="#1e293b" />
      <circle cx="8" cy="10" r="2.2" fill="#1e293b" />
      <circle cx="28" cy="10" r="2.2" fill="#1e293b" />
      <circle cx="15.5" cy="5.5" r="1.8" fill="#334155" />
      <circle cx="20.5" cy="5.5" r="1.8" fill="#334155" />
      <circle cx="11" cy="15.5" r="1.8" fill="#334155" />
      <circle cx="25" cy="15.5" r="1.8" fill="#334155" />
      <circle cx="6.5" cy="16" r="1.8" fill="#64748b" />
      <circle cx="29.5" cy="16" r="1.8" fill="#64748b" />
    </svg>
  );
};
