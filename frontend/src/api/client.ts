import axios from 'axios';
import {
  Catalog,
  Product,
  ClassificationResult,
  TaxonomyCategory,
  TaxonomyAttribute,
  TaxonomyVersion,
  ProcessingJob,
  ReviewDecision,
  CatalogProgress,
} from '../types';

// In development, Vite proxies /api → Django. In production, set VITE_API_BASE.
const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';

export const apiClient = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Auth ──────────────────────────────────────────────────────────────────────
export interface UserProfile {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_staff: boolean;
  role: 'USER' | 'ADMIN';
  is_active: boolean;
  date_joined: string | null;
}

export const registerUser = async (data: {
  name: string;
  email: string;
  password: string;
  confirm_password: string;
  username?: string;
}): Promise<{ message: string; user: UserProfile }> => {
  const res = await apiClient.post('/auth/register/', data);
  return res.data;
};

export const loginUser = async (credentials: {
  username?: string;
  email?: string;
  password: string;
}): Promise<{ message: string; user: UserProfile }> => {
  const res = await apiClient.post('/auth/login/', credentials);
  return res.data;
};

export const adminLogin = async (credentials: {
  username?: string;
  email?: string;
  password: string;
}): Promise<{ message: string; user: UserProfile }> => {
  const res = await apiClient.post('/auth/admin-login/', credentials);
  return res.data;
};

export const logoutUser = async (): Promise<{ message: string }> => {
  const res = await apiClient.post('/auth/logout/');
  return res.data;
};

export const fetchCurrentUser = async (): Promise<{ authenticated: boolean; user: UserProfile | null }> => {
  const res = await apiClient.get('/auth/me/');
  return res.data;
};

export const updateProfile = async (data: { name?: string; email?: string }): Promise<{ message: string; user: UserProfile }> => {
  const res = await apiClient.put('/auth/profile/', data);
  return res.data;
};

export const changePassword = async (data: {
  current_password: string;
  new_password: string;
  confirm_password: string;
}): Promise<{ message: string }> => {
  const res = await apiClient.post('/auth/change-password/', data);
  return res.data;
};

// ─── Health ────────────────────────────────────────────────────────────────────
export const fetchHealthCheck = async (): Promise<{ status: string; service: string; version: string }> => {
  const res = await apiClient.get('/health/');
  return res.data;
};

// ─── Catalogs ─────────────────────────────────────────────────────────────────
export const fetchCatalogs = async (): Promise<Catalog[]> => {
  const res = await apiClient.get('/catalogs/');
  return res.data.results || res.data;
};

export const fetchCatalogStats = async (): Promise<{
  total_catalogs: number;
  total_products: number;
  classified_count: number;
  needs_review_count: number;
  approved_count: number;
  declined_count: number;
  pending_count: number;
}> => {
  const res = await apiClient.get('/catalogs/stats/');
  return res.data;
};

export const resetCatalogs = async (): Promise<{ message: string; removed_catalogs_count: number }> => {
  const res = await apiClient.post('/catalogs/reset/');
  return res.data;
};

export const fetchCatalog = async (id: string): Promise<Catalog> => {
  const res = await apiClient.get(`/catalogs/${id}/`);
  return res.data;
};

export const uploadCatalog = async (file: File, name: string): Promise<Catalog> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('name', name);
  const res = await apiClient.post('/catalogs/upload/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.catalog || res.data;
};

export const deleteCatalog = async (catalogId: string): Promise<any> => {
  const res = await apiClient.delete(`/catalogs/${catalogId}/`);
  return res.data;
};

export const startClassification = async (catalogId: string, retryFailedOnly = false): Promise<any> => {
  const res = await apiClient.post(`/catalogs/${catalogId}/start-classification/`, {
    retry_failed_only: retryFailedOnly,
  });
  return res.data;
};

export const fetchCatalogProgress = async (catalogId: string): Promise<CatalogProgress> => {
  if (catalogId === 'ALL') {
    const res = await apiClient.get('/catalogs/all-progress/');
    return res.data;
  }
  const res = await apiClient.get(`/catalogs/${catalogId}/progress/`);
  return res.data;
};

// ─── Products ─────────────────────────────────────────────────────────────────
export const fetchProducts = async (params: {
  catalog_id?: string;
  category?: string;
  status?: string;
  confidence_level?: string;
  brand?: string;
  search?: string;
  page?: number;
  page_size?: number;
}): Promise<{ count: number; next: string | null; previous: string | null; results: Product[] }> => {
  const res = await apiClient.get('/products/', { params });
  return res.data;
};

export const fetchProduct = async (id: string): Promise<Product> => {
  const res = await apiClient.get(`/products/${id}/`);
  return res.data;
};

export const deleteProduct = async (id: string): Promise<void> => {
  await apiClient.delete(`/products/${id}/`);
};

export const createProduct = async (data: {
  catalog: string;
  title: string;
  product_number?: string;
  brand?: string;
  product_type?: string;
  description?: string;
  materials?: string;
  color?: string;
}): Promise<Product> => {
  const res = await apiClient.post('/products/', data);
  return res.data;
};

// ─── Classification ───────────────────────────────────────────────────────────
export const fetchClassifications = async (params: {
  catalog_id?: string;
  confidence_level?: string;
  status?: string;
  page?: number;
}): Promise<{ count: number; next: string | null; previous: string | null; results: ClassificationResult[] }> => {
  const res = await apiClient.get('/classifications/', { params });
  return res.data;
};

export const fetchClassification = async (id: string): Promise<ClassificationResult> => {
  const res = await apiClient.get(`/classifications/${id}/`);
  return res.data;
};

export const approveClassification = async (id: string, reviewer = 'admin', notes = 'Approved'): Promise<any> => {
  const res = await apiClient.post(`/classifications/${id}/approve/`, { reviewer, notes });
  return res.data;
};

export const rejectClassification = async (id: string, reviewer = 'admin', notes = 'Rejected'): Promise<any> => {
  const res = await apiClient.post(`/classifications/${id}/reject/`, { reviewer, notes });
  return res.data;
};

export const bulkApproveEligible = async (catalogId?: string, reviewer = 'admin'): Promise<{ message: string; approved_count: number }> => {
  const res = await apiClient.post('/classifications/bulk-approve-eligible/', { catalog_id: catalogId, reviewer });
  return res.data;
};

export const overrideClassification = async (
  id: string,
  categoryId: number,
  reviewer = 'admin',
  notes = 'Overridden'
): Promise<ClassificationResult> => {
  const res = await apiClient.post(`/classifications/${id}/override/`, {
    category_id: categoryId,
    reviewer,
    notes,
  });
  return res.data;
};

// ─── Manual Review Queue ──────────────────────────────────────────────────────
export const fetchReviewQueue = async (params: { catalog_id?: string; page?: number }): Promise<{
  count: number;
  next: string | null;
  previous: string | null;
  results: ClassificationResult[];
}> => {
  const res = await apiClient.get('/reviews/', { params });
  return res.data;
};

export const fetchReviewHistory = async (params: { catalog_id?: string; page?: number }): Promise<{
  count: number;
  next: string | null;
  previous: string | null;
  results: ReviewDecision[];
}> => {
  const res = await apiClient.get('/reviews/history/', { params });
  return res.data;
};

export const bulkApproveReviews = async (ids: string[]): Promise<any> => {
  const res = await apiClient.post('/reviews/bulk-approve/', { classification_ids: ids });
  return res.data;
};

// ─── Taxonomy ─────────────────────────────────────────────────────────────────
export const fetchTaxonomyCategories = async (params: {
  is_leaf?: boolean;
  is_root?: boolean;
  parent_id?: number;
  search?: string;
  page?: number;
}): Promise<{ count: number; next: string | null; previous: string | null; results: TaxonomyCategory[] }> => {
  const res = await apiClient.get('/taxonomy/categories/', { params });
  return res.data;
};

export const fetchTaxonomyCategory = async (id: number): Promise<TaxonomyCategory> => {
  const res = await apiClient.get(`/taxonomy/categories/${id}/`);
  return res.data;
};

export const fetchTaxonomyCategoryAttributes = async (id: number): Promise<TaxonomyAttribute[]> => {
  const res = await apiClient.get(`/taxonomy/categories/${id}/attributes/`);
  return res.data;
};

export const fetchTaxonomyRoots = async (): Promise<TaxonomyCategory[]> => {
  const res = await apiClient.get('/taxonomy/categories/tree/');
  return res.data;
};

export const fetchActiveTaxonomyVersion = async (): Promise<TaxonomyVersion> => {
  const res = await apiClient.get('/taxonomy/versions/active/');
  return res.data;
};

export const fetchTaxonomyVersions = async (): Promise<TaxonomyVersion[]> => {
  const res = await apiClient.get('/taxonomy/versions/');
  return res.data.results || res.data;
};

// ─── Jobs ─────────────────────────────────────────────────────────────────────
export const fetchJobs = async (params: { catalog_id?: string; page?: number }): Promise<{
  count: number;
  next: string | null;
  previous: string | null;
  results: ProcessingJob[];
}> => {
  const res = await apiClient.get('/jobs/', { params });
  return res.data;
};

export const cancelJob = async (id: string): Promise<any> => {
  const res = await apiClient.post(`/jobs/${id}/cancel/`);
  return res.data;
};

export interface CategorySummaryItem {
  category_id: number;
  category_gid: string;
  name: string;
  full_path: string;
  level: number;
  is_leaf: boolean;
  product_count: number;
}

export interface CategorySummaryResponse {
  catalog_id: string;
  catalog_name: string;
  total_products: number;
  total_classified: number;
  total_classified_products?: number;
  unique_categories_count: number;
  categories: CategorySummaryItem[];
}

export interface GroupedProductItem {
  classification_id: string;
  product_id: string;
  product_number: string;
  title: string;
  brand: string;
  product_type: string;
  status: string;
  confidence_score: number;
  confidence_level: string;
  category_id: number;
  category_gid: string;
  category_name: string;
  category_full_path: string;
}

export const fetchCategorySummary = async (catalogId: string): Promise<CategorySummaryResponse> => {
  if (catalogId === 'ALL') {
    const res = await apiClient.get('/catalogs/all-category-summary/');
    return res.data;
  }
  const res = await apiClient.get(`/catalogs/${catalogId}/category-summary/`);
  return res.data;
};

export const fetchGroupedProducts = async (
  catalogId: string,
  categoryGid?: string
): Promise<{ catalog_id: string; count: number; products: GroupedProductItem[] }> => {
  const res = await apiClient.get(`/catalogs/${catalogId}/grouped-products/`, {
    params: { category_gid: categoryGid },
  });
  return res.data;
};
