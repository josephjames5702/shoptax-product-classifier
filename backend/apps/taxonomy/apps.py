from django.apps import AppConfig

class TaxonomyConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.taxonomy'

    def ready(self):
        import os
        # Prevent pre-warming during migrations or build scripts
        if os.environ.get('RUN_MAIN') == 'true' or not os.environ.get('DJANGO_SETTINGS_MODULE'):
            import threading
            def _prewarm():
                try:
                    import time
                    time.sleep(1)
                    from services.semantic_embedding import SentenceEmbeddingEngine
                    from services.retrieval_service import RetrievalService
                    SentenceEmbeddingEngine.get_instance()
                    RetrievalService.get_instance()
                except Exception:
                    pass
            threading.Thread(target=_prewarm, daemon=True).start()
