import { Product } from '../types';

/**
 * Returns a stable grouping key for a product.
 * Priority:
 * 1. model_number
 * 2. title (normalized)
 * 3. fallback to product id if neither exists (won't group)
 */
export const getProductGroupKey = (product: Product): string => {
  if (product.model_number && product.model_number.trim() !== '') {
    return product.model_number.trim();
  }
  
  if (product.title && product.title.trim() !== '') {
    // Normalize title for better matching (lowercase, remove extra spaces)
    return product.title.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  // Fallback to prevent grouping unrelated items
  return `single-${product.id}`;
};

/**
 * Groups an array of products by their group key.
 * Returns an array of groups, where each group is an array of Products.
 */
export const groupProductsByModel = (products: Product[]): Product[][] => {
  const groupsMap = new Map<string, Product[]>();
  const orderedKeys: string[] = [];

  for (const p of products) {
    const key = getProductGroupKey(p);
    
    if (!groupsMap.has(key)) {
      groupsMap.set(key, []);
      orderedKeys.push(key);
    }
    
    groupsMap.get(key)!.push(p);
  }

  return orderedKeys.map(key => groupsMap.get(key)!);
};
