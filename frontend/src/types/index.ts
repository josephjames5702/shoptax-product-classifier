export interface Catalog {
  id: string;
  owner?: number | null;
  owner_username?: string;
  name: string;
  file_name: string;
  file_size: number;
  total_rows: number;
  total_products: number;
  status: 'UPLOADED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  summary_stats: {
    total_rows?: number;
    total_products?: number;
    with_images?: number;
    without_images?: number;
    missing_descriptions?: number;
    duplicate_skus?: number;
    invalid_image_urls?: number;
  };
  column_mapping: {
    mapped?: Record<string, string>;
    unmapped?: string[];
    images?: number;
  };
  created_at: string;
  updated_at: string;
}

export interface ProductImage {
  id: string;
  url: string;
  position: number;
  status: 'PENDING' | 'DOWNLOADED' | 'FAILED' | 'INVALID';
  error_message?: string;
  image_hash?: string;
  local_path?: string;
  width?: number;
  height?: number;
  created_at: string;
}

export interface TaxonomyVersion {
  id: number;
  version_code: string;
  release_tag?: string;
  release_name?: string;
  release_status?: string;
  name: string;
  status: 'IMPORTING' | 'ACTIVE' | 'ARCHIVED' | 'FAILED';
  is_active: boolean;
  source_urls?: Record<string, string>;
  asset_checksums?: Record<string, string>;
  stats?: {
    categories_count?: number;
    root_categories_count?: number;
    leaf_categories_count?: number;
    attributes_count?: number;
    values_count?: number;
    category_attributes_count?: number;
  };
  error_message?: string;
  imported_at: string;
  completed_at?: string;
}

export interface TaxonomyCategory {
  id: number;
  external_id: string;
  name: string;
  full_path: string;
  level: number;
  is_leaf: boolean;
  is_root: boolean;
  parent_id?: number | null;
  ancestors?: TaxonomyCategory[];
  children?: TaxonomyCategory[];
  attributes?: TaxonomyAttribute[];
}

export interface TaxonomyAttributeValue {
  id: number;
  external_id: string;
  name: string;
  handle?: string;
  normalized_name: string;
}

export interface TaxonomyAttribute {
  id: number;
  external_id: string;
  name: string;
  handle: string;
  description: string;
  data_type: string;
  is_required?: boolean;
  is_extended?: boolean;
  values: TaxonomyAttributeValue[];
}

export interface ExtractedAttribute {
  id: string;
  attribute_id: number;
  attribute_name: string;
  attribute_external_id: string;
  raw_value: string;
  normalized_value: string;
  is_valid_taxonomy_value: boolean;
  source: 'TEXT' | 'IMAGE' | 'STRUCTURED' | 'MULTIMODAL';
  confidence: number;
}

export interface ClassificationAlternative {
  id: string;
  category: TaxonomyCategory;
  rank: number;
  score: number;
  reason: string;
  supporting_evidence: string;
}

export interface ClassificationResult {
  id: string;
  product_id: string;
  product_title: string;
  product_number?: string;
  taxonomy_version_id: number;
  category: TaxonomyCategory;
  confidence_score: number;
  confidence_level: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'OVERRIDDEN';
  reasoning: string;
  text_evidence: string;
  image_evidence: string;
  signals_breakdown: {
    composite_score: number;
    review_required: boolean;
    review_reasons: string[];
    scores: {
      semantic_similarity: number;
      lexical_match: number;
      hierarchical_consistency: number;
      llm_reranker_score: number;
      attribute_consistency: number;
      image_evidence: number;
      data_completeness: number;
    };
  };
  model_version: string;
  created_at: string;
  updated_at: string;
  alternatives: ClassificationAlternative[];
  extracted_attributes: ExtractedAttribute[];
}

export interface Product {
  id: string;
  catalog_id: string;
  catalog_name?: string;
  catalog_owner_username?: string;
  product_number?: string;
  model_number?: string;
  title: string;
  description?: string;
  bullets?: string;
  brand?: string;
  product_type?: string;
  materials?: string;
  color?: string;
  color_collection?: string;
  dimensions?: string;
  set_includes?: string;
  item_cost?: number;
  map_price?: number;
  msrp?: number;
  country_of_origin?: string;
  shipping_method?: string;
  product_url?: string;
  raw_data: Record<string, any>;
  processing_status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'RETRYING' | 'MANUAL_REVIEW' | 'AUTO_APPROVED' | 'CLASSIFIED' | 'REQUIRES_REVIEW';
  decision_status?: 'NOT_REVIEWED' | 'AUTO_CLASSIFIED' | 'ADMIN_APPROVED' | 'ADMIN_DECLINED' | 'REQUIRES_REVIEW';
  reviewed_by?: string;
  reviewed_at?: string;
  decline_reason?: string;
  attempts: number;
  last_error?: string;
  last_processed_at?: string;
  created_at: string;
  primary_image?: string;
  images?: ProductImage[];
  classification_summary?: {
    id: string;
    category_name: string;
    category_path: string;
    confidence_score: number;
    confidence_level: 'HIGH' | 'MEDIUM' | 'LOW';
    status: string;
    attributes?: Array<{ name: string; value: string }>;
    alternatives?: Array<{ category_name: string; score: number }>;
    ai_mode?: string;
    reasoning?: string;
  };
  classification_result?: ClassificationResult;
}

export interface ProcessingJob {
  id: string;
  catalog_id: string;
  catalog_name: string;
  job_type: 'CLASSIFICATION' | 'RETRY_FAILED' | 'IMAGE_DOWNLOAD';
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  total_items: number;
  processed_items: number;
  successful_items: number;
  failed_items: number;
  progress_percentage: number;
  current_step: string;
  error_log: Array<{ product_id: string; error: string }>;
  celery_task_id?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ReviewDecision {
  id: string;
  classification_result_id: string;
  classification?: ClassificationResult;
  action: 'APPROVE' | 'OVERRIDE' | 'REJECT';
  reviewer: string;
  old_category?: TaxonomyCategory;
  new_category?: TaxonomyCategory;
  notes: string;
  created_at: string;
}

export interface CatalogProgress {
  catalog_id: string;
  catalog_status: string;
  total_products: number;
  completed: number;
  failed: number;
  manual_review: number;
  pending: number;
  processing: number;
  retrying: number;
  progress_percentage: number;
  latest_job?: {
    id: string;
    status: string;
    job_type: string;
    current_step: string;
  } | null;
}
