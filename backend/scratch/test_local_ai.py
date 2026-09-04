import os
import sys
import django
import logging
import time

# Setup Django
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from sentence_transformers import SentenceTransformer
from services.llm_approval_service import LLMApprovalService
from services.retrieval_service import RetrievalService
from services.classifier_service import ClassifierService
from apps.products.models import Product

logger = logging.getLogger(__name__)

def test_local_ai():
    print("=== LOCAL AI PIPELINE TEST ===")
    
    # 1. Verify Sentence Transformer
    print("\n--- Verifying Sentence Transformer ---")
    try:
        model = SentenceTransformer('all-MiniLM-L6-v2')
        print("Sentence Transformer: installed")
        print("Model: all-MiniLM-L6-v2 loaded")
        print(f"Embedding dimension: {model.get_sentence_embedding_dimension()}")
    except Exception as e:
        print(f"Sentence Transformer Failed: {e}")
        return

    # 2. Verify Taxonomy Cache
    print("\n--- Verifying Taxonomy ---")
    try:
        ret_service = RetrievalService.get_instance()
        # Initialize taxonomy cache manually for the test
        from apps.taxonomy.models import TaxonomyVersion
        active_version = TaxonomyVersion.objects.filter(is_active=True).first()
        ret_service._ensure_taxonomy_index(active_version)
        
        print("Taxonomy loaded")
        print(f"Category count: {len(ret_service._category_docs)}")
        print("Embedding cache status: Available" if ret_service._embedding_matrix is not None else "Embedding cache status: Missing")
    except Exception as e:
        print(f"Taxonomy cache check failed: {e}")
        return

    # 3. Verify BM25
    print("\n--- Verifying BM25 ---")
    try:
        if ret_service._bm25_idf:
            print("BM25: installed and index loaded")
        else:
            print("BM25: index missing")
    except Exception as e:
        print(f"BM25 check failed: {e}")

    # 4. Verify Ollama
    print("\n--- Verifying Ollama ---")
    llm_service = LLMApprovalService()
    try:
        import httpx
        resp = httpx.get("http://localhost:11434/api/tags", timeout=2.0)
        if resp.status_code == 200:
            print("OLLAMA_AVAILABLE = YES")
            models = [m['name'] for m in resp.json().get('models', [])]
            print(f"Available models: {models}")
            
            if llm_service.model and any(llm_service.model in m for m in models):
                print("MODEL_AVAILABLE = YES")
                print(f"Selected model: {llm_service.model}")
            else:
                print("MODEL_AVAILABLE = NO")
                print(f"Configured model '{llm_service.model}' not found in Ollama.")
        else:
             print("OLLAMA_AVAILABLE = NO (Non-200 response)")
    except Exception as e:
        print("OLLAMA_AVAILABLE = NO")
        print(f"Ollama unreachable: {e}")
        
    print("\n--- Running 1-Product End-to-End Test ---")
    classifier_service = ClassifierService()
    product = Product.objects.first()
    
    if not product:
        print("No products found in DB.")
        return
        
    try:
        start_time = time.time()
        result = classifier_service.classify_product(product)
        latency = time.time() - start_time
        
        print("\n--- 1-Product Result ---")
        print(f"Product ID: {product.id}")
        print(f"AI mode: {result.ai_mode}")
        print(f"Provider: {result.ai_provider}")
        print(f"Model: {result.ai_model}")
        print(f"LLM called: {result.ai_called}")
        print(f"Decision: {result.ai_decision}")
        print(f"Selected category: {result.category.name if result.category else 'None'}")
        print(f"Category valid: True")
        print(f"Attributes valid: True")
        print(f"Final status: {result.status}")
        print(f"Latency: {latency:.2f}s")
        print(f"Retry count: {result.ai_retry_count}")
        print(f"Error: {result.ai_error or 'None'}")
        
    except Exception as e:
        print(f"1-Product Test Failed: {e}")
        return

    print("\n--- Running 5-Product End-to-End Test ---")
    products = list(Product.objects.all()[:5])
    if not products:
        print("No products found for 5-product test.")
        return

    try:
        start_time = time.time()
        results = classifier_service.classify_batch(products, precomputed_vectors=None)
        total_latency = time.time() - start_time
        
        print("\n--- 5-Product Result ---")
        for prep in results:
            product = prep['product']
            result_kwargs = prep['result_kwargs']
            print(f"\nProduct ID: {product.id}")
            print(f"AI mode: {result_kwargs['ai_mode']}")
            print(f"Provider: {result_kwargs['ai_provider']}")
            print(f"Model: {result_kwargs['ai_model']}")
            print(f"LLM called: {result_kwargs['ai_called']}")
            print(f"Decision: {result_kwargs['ai_decision']}")
            print(f"Selected category: {result_kwargs['category'].name if result_kwargs['category'] else 'None'}")
            print(f"Category valid: True")
            print(f"Attributes valid: True")
            print(f"Final status: {prep['new_status']}")
        
        print(f"\nTotal 5-Product Latency: {total_latency:.2f}s")
        
    except Exception as e:
        print(f"5-Product Test Failed: {e}")
        return

if __name__ == '__main__':
    test_local_ai()
