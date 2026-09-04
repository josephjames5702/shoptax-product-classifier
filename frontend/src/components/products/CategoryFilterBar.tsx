import React, { useRef, useEffect, useState } from 'react';
import { CategoryCount } from '../../utils/productCategories';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CategoryFilterBarProps {
  categories: CategoryCount[];
  selectedCategory: string;
  onSelectCategory: (categoryName: string) => void;
}

export const CategoryFilterBar: React.FC<CategoryFilterBarProps> = ({
  categories,
  selectedCategory,
  onSelectCategory,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  const checkScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setShowLeftArrow(scrollLeft > 0);
      setShowRightArrow(Math.ceil(scrollLeft + clientWidth) < scrollWidth);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [categories]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 300;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
      // The scroll event listener handles updating the arrows
    }
  };

  if (categories.length <= 1) {
    return null; // Don't show the bar if there are no meaningful categories to filter
  }

  return (
    <div className="relative flex items-center w-full mb-6 bg-white border border-slate-200 rounded-lg shadow-sm">
      {/* Left scroll button */}
      {showLeftArrow && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 z-10 p-2 bg-white/90 border-r border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-l-lg h-full transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}

      {/* Scrollable container */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-x-auto scrollbar-hide py-2 px-3 flex space-x-2 scroll-smooth"
        onScroll={checkScroll}
      >
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat.name;
          return (
            <button
              key={cat.name}
              onClick={() => onSelectCategory(cat.name)}
              className={`flex-shrink-0 flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                isSelected
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
              }`}
              aria-pressed={isSelected}
            >
              {cat.name}
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold ${
                isSelected 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'bg-slate-100 text-slate-500'
              }`}>
                {cat.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Right scroll button */}
      {showRightArrow && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 z-10 p-2 bg-white/90 border-l border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-r-lg h-full transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
          aria-label="Scroll right"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};
