import os
import sys
import time
import django

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.catalogs.models import Catalog
from apps.products.models import Product
from services.llm_approval_service import LLMApprovalService
from services.semantic_embedding import SentenceEmbeddingEngine
from services.classifier_service import ClassifierService

def run_test():
    llm_service = LLMApprovalService()
    
    if not llm_service.is_configured:
        print("STOPPING REAL-AI TEST: Missing Configuration.")
        print("Please configure AI_PROVIDER, AI_MODEL, and AI_API_KEY environment variables.")
        return

    catalog = Catalog.objects.get(id="4aaee261-b8ac-46a4-8f5c-665b46ff1d15")
    products = list(Product.objects.filter(catalog=catalog)[:5])
    
    print(f"Running Phase 1 Verification Test on {len(products)} products...")
    
    classifier = ClassifierService()
    encoder = SentenceEmbeddingEngine.get_instance()
    
    batch_texts = [
        f"{p.title or ''} {p.product_type or ''} {p.brand or ''} {p.materials or ''} {p.color or ''} {(p.bullets or '')[:200]} {(p.description or '')[:300]}"
        for p in products
    ]
    batch_vectors = encoder.batch_encode(batch_texts)
    
    for idx, p in enumerate(products):
        print(f"\n--- Testing Product: {p.title[:50]} ---")
        
        # 1. Semantic Classification (Candidate Retrieval)
        retrieval_res = classifier.classify_batch([p], precomputed_vectors=batch_vectors[idx:idx+1])[0]
        
        candidates = retrieval_res.get('candidates', [])
        if not candidates:
            # Mock candidate list from the top result for this test.
            from apps.taxonomy.models import TaxonomyCategory
            top_cat = TaxonomyCategory.objects.filter(id=retrieval_res['category_id']).first()
            candidates = [{'category_id': top_cat.id, 'full_path': top_cat.full_path, 'name': top_cat.name}]
            
        print(f"Top Semantic Candidate: {candidates[0]['full_path']}")
        
        t0 = time.time()
        try:
            llm_decision = llm_service.validate_classification(
                product_data={'title': p.title, 'description': p.description, 'brand': p.brand, 'product_type': p.product_type},
                candidates=candidates
            )
            t1 = time.time()
            
            print(f"LLM Actually Called: True")
            print(f"Provider: {llm_decision.get('actual_provider')}")
            print(f"Model: {llm_decision.get('actual_model')}")
            print(f"Decision: {llm_decision.get('decision')}")
            print(f"Latency: {t1 - t0:.2f}s")
            
        except Exception as e:
            print(f"LLM Call Failed: {e}")

if __name__ == "__main__":
    run_test()
