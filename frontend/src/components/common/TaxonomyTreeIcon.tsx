import React from 'react';

interface TaxonomyTreeIconProps {
  className?: string;
  size?: number;
}

export const TaxonomyTreeIcon: React.FC<TaxonomyTreeIconProps> = ({
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
      {/* Root Node (top center) */}
      <rect
        x="13"
        y="3"
        width="10"
        height="7"
        rx="2"
        fill="#bae6fd"
        stroke="#0284c7"
        strokeWidth="2"
      />

      {/* Connecting Tree Lines */}
      {/* Vertical stem from root */}
      <path d="M18 10V18" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />
      {/* Horizontal connector bar */}
      <path d="M7 18H29" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />
      {/* Drop lines to leaves */}
      <path d="M7 18V24" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />
      <path d="M18 18V24" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />
      <path d="M29 18V24" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />

      {/* Leaf Node 1 (left) */}
      <rect
        x="3"
        y="24"
        width="8"
        height="7"
        rx="2"
        fill="#a7f3d0"
        stroke="#059669"
        strokeWidth="2"
      />

      {/* Leaf Node 2 (center) */}
      <rect
        x="14"
        y="24"
        width="8"
        height="7"
        rx="2"
        fill="#a7f3d0"
        stroke="#059669"
        strokeWidth="2"
      />

      {/* Leaf Node 3 (right) */}
      <rect
        x="25"
        y="24"
        width="8"
        height="7"
        rx="2"
        fill="#a7f3d0"
        stroke="#059669"
        strokeWidth="2"
      />
    </svg>
  );
};
