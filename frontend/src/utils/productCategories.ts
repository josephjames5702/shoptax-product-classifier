import { Product } from '../types';

export const UNCLASSIFIED_CATEGORY = 'Unclassified';
export const ALL_ITEMS_CATEGORY = 'All Items';

/**
 * Returns the cleanest available category name for a product.
 * Prefers the classification summary or result, and falls back to "Unclassified".
 */
export const getProductCategory = (product: Product): string => {
  if (product.classification_summary?.category_name) {
    return product.classification_summary.category_name;
  }
  if (product.classification_result?.category?.name) {
    return product.classification_result.category.name;
  }
  return UNCLASSIFIED_CATEGORY;
};

export interface CategoryCount {
  name: string;
  count: number;
}

/**
 * Calculates category counts for an array of products.
 * Returns a sorted array: "All Items" first, then ordered by count descending,
 * with alphabetical tie-breaking.
 */
export const getCategoryCounts = (products: Product[]): CategoryCount[] => {
  const countsMap = new Map<string, number>();

  for (const p of products) {
    const category = getProductCategory(p);
    countsMap.set(category, (countsMap.get(category) || 0) + 1);
  }

  const sortedCategories = Array.from(countsMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => {
      // Sort by count descending
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      // Tie-break alphabetically
      return a.name.localeCompare(b.name);
    });

  return [
    { name: ALL_ITEMS_CATEGORY, count: products.length },
    ...sortedCategories
  ];
};

/**
 * Filters products by the specified category name.
 * If categoryName is "All Items", returns the original array.
 */
export const filterProductsByCategory = (products: Product[], categoryName: string): Product[] => {
  if (categoryName === ALL_ITEMS_CATEGORY) {
    return products;
  }
  
  return products.filter((p) => getProductCategory(p) === categoryName);
};
