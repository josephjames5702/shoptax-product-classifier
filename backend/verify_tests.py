import django, os, time
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from apps.catalogs.models import Catalog
from apps.products.models import Product
from apps.classification.models import ClassificationResult
from apps.jobs.models import ProcessingJob
from services.import_service import ImportService
from services.pipeline_runner import PipelineRunner
from rest_framework.test import APIRequestFactory
from apps.products.views import ProductViewSet

# Clean up
Catalog.objects.all().delete()
print('Cleaned DB')

fpath = r'C:\Users\josep\OneDrive\project\Product List.xlsx'
importer = ImportService('Product_List_100_Samples', fpath, 'Product_List_100_Samples.xlsx')
cat = importer.parse_and_create(batch_size=50, sample_limit=100)
cat.status = Catalog.Status.UPLOADED
cat.save()
total = cat.products.count()
pending = cat.products.filter(processing_status='PENDING').count()
print(f'DEMO CATALOG ID: {cat.id}  total={total}  pending={pending}')
assert total == 100 and pending == 100

factory = APIRequestFactory()
view = ProductViewSet.as_view({'get': 'list'})
r1 = view(factory.get('/', {'catalog_id': str(cat.id), 'page': '1', 'page_size': '25'}))
r2 = view(factory.get('/', {'catalog_id': str(cat.id), 'page': '2', 'page_size': '25'}))
r4 = view(factory.get('/', {'catalog_id': str(cat.id), 'page': '4', 'page_size': '25'}))
print(f'Pagination p1: count={r1.data["count"]} results={len(r1.data["results"])}')
print(f'Pagination p2: count={r2.data["count"]} results={len(r2.data["results"])}')
print(f'Pagination p4: count={r4.data["count"]} results={len(r4.data["results"])}')
assert r1.data['count'] == 100 and len(r1.data['results']) == 25
assert r4.data['count'] == 100 and len(r4.data['results']) == 25
print('PASS: Pagination 4 pages of 25')

t0 = time.time()
job = ProcessingJob.objects.create(catalog=cat, total_items=total)
runner = PipelineRunner(cat, job, batch_size=25)
runner.run()
elapsed = round(time.time()-t0, 1)
classified = cat.products.filter(processing_status='CLASSIFIED').count()
review = cat.products.filter(processing_status='REQUIRES_REVIEW').count()
failed = cat.products.filter(processing_status='FAILED').count()
results_count = ClassificationResult.objects.filter(product__catalog=cat).count()
print(f'Classification took: {elapsed}s  ({round(elapsed/100,3)}s/product)')
print(f'CLASSIFIED={classified}  REQUIRES_REVIEW={review}  FAILED={failed}  ResultRecords={results_count}')
assert classified + review + failed == 100
print('PASS: Classification complete, 100 products processed')

# ─────────────────────────────────────────────────────────────────────────────
# ROLE-BASED AUTH & LIVE SYNC TEST SUITE
# ─────────────────────────────────────────────────────────────────────────────
print('\n=== STARTING ROLE-BASED & SYNC TESTS ===')
from django.test import Client
from django.contrib.auth.models import User

User.objects.filter(username__in=['user_a@test.com', 'user_b@test.com']).delete()
client = Client()

# 1. User Registration
r_reg = client.post('/api/auth/register/', {
    'name': 'User A',
    'email': 'user_a@test.com',
    'password': 'Password123!',
    'confirm_password': 'Password123!'
}, content_type='application/json')
assert r_reg.status_code == 201, f'Register failed: {r_reg.status_code} {r_reg.data}'
user_a = User.objects.get(username='user_a@test.com')
print('TEST 1: User Registration -> PASS')

# 2. User Login
client.logout()
r_login = client.post('/api/auth/login/', {
    'username': 'user_a@test.com',
    'password': 'Password123!'
}, content_type='application/json')
assert r_login.status_code == 200, f'Login failed: {r_login.data}'
assert r_login.data['user']['role'] == 'USER'
print('TEST 2: User Login -> PASS')

# 3. Profile Update & Password Change
r_prof = client.put('/api/auth/profile/', {'name': 'User A Updated'}, content_type='application/json')
assert r_prof.status_code == 200, f'Profile update failed: {r_prof.data}'

r_pwd = client.post('/api/auth/change-password/', {
    'current_password': 'Password123!',
    'new_password': 'NewPassword123!',
    'confirm_password': 'NewPassword123!'
}, content_type='application/json')
assert r_pwd.status_code == 200, f'Password change failed: {r_pwd.data}'

client.logout()
r_relogin = client.post('/api/auth/login/', {
    'username': 'user_a@test.com',
    'password': 'NewPassword123!'
}, content_type='application/json')
assert r_relogin.status_code == 200, 'Re-login with new password failed'
print('TEST 3: Profile Update & Password Change -> PASS')

# 4. Normal User trying Admin Login -> must receive 403
r_admin_denied = client.post('/api/auth/admin-login/', {
    'username': 'user_a@test.com',
    'password': 'NewPassword123!'
}, content_type='application/json')
assert r_admin_denied.status_code == 403, f'Admin access protection failed: expected 403 got {r_admin_denied.status_code}'
print('TEST 4: Admin route security & 403 protection -> PASS')

# 5. Admin Login
admin_client = Client()
r_admin_login = admin_client.post('/api/auth/admin-login/', {
    'username': 'admin',
    'password': 'Admin123!'
}, content_type='application/json')
assert r_admin_login.status_code == 200, f'Admin login failed: {r_admin_login.data}'
assert r_admin_login.data['user']['role'] == 'ADMIN'
print('TEST 5: Staff Admin Login -> PASS')

# 6. User Isolation & Catalogue Visibility
cat_user_a = Catalog.objects.create(name='Cat User A', file_name='cat_a.csv', total_products=10, owner=user_a)
prod_user_a = Product.objects.create(catalog=cat_user_a, title='Product of User A', product_number='SKU-A1')

user_b = User.objects.create_user(username='user_b@test.com', email='user_b@test.com', password='Password123!')
cat_user_b = Catalog.objects.create(name='Cat User B', file_name='cat_b.csv', total_products=5, owner=user_b)
prod_user_b = Product.objects.create(catalog=cat_user_b, title='Product of User B', product_number='SKU-B1')

r_user_cats = client.get('/api/catalogs/')
user_a_cat_ids = [c['id'] for c in r_user_cats.data.get('results', r_user_cats.data)]
assert str(cat_user_a.id) in user_a_cat_ids, 'User A should see Cat A'
assert str(cat_user_b.id) not in user_a_cat_ids, 'User A MUST NOT see Cat B'

r_user_prods = client.get('/api/products/')
user_a_prod_ids = [p['id'] for p in r_user_prods.data.get('results', r_user_prods.data)]
assert str(prod_user_a.id) in user_a_prod_ids, 'User A should see Product A'
assert str(prod_user_b.id) not in user_a_prod_ids, 'User A MUST NOT see Product B'

r_admin_cats = admin_client.get('/api/catalogs/')
admin_cat_ids = [c['id'] for c in r_admin_cats.data.get('results', r_admin_cats.data)]
assert str(cat_user_a.id) in admin_cat_ids and str(cat_user_b.id) in admin_cat_ids, 'Admin must see both Cat A and Cat B'

r_admin_prods_a = admin_client.get(f'/api/products/?catalog_id={cat_user_a.id}')
admin_prod_a_ids = [p['id'] for p in r_admin_prods_a.data.get('results', r_admin_prods_a.data)]
assert str(prod_user_a.id) in admin_prod_a_ids, 'Admin must see Product A'

r_admin_prods_b = admin_client.get(f'/api/products/?catalog_id={cat_user_b.id}')
admin_prod_b_ids = [p['id'] for p in r_admin_prods_b.data.get('results', r_admin_prods_b.data)]
assert str(prod_user_b.id) in admin_prod_b_ids, 'Admin must see Product B'
print('TEST 6: Multi-tenant User Isolation & Admin Global Access -> PASS')

# 7. Admin Approval on Review Product & Shared DB Sync
from apps.taxonomy.models import TaxonomyCategory, TaxonomyVersion
tax_ver = TaxonomyVersion.objects.first()
tax_cat = TaxonomyCategory.objects.first()
cls_a = ClassificationResult.objects.create(
    product=prod_user_a,
    taxonomy_version=tax_ver,
    category=tax_cat,
    confidence_score=0.45,
    status=ClassificationResult.ReviewStatus.PENDING_REVIEW
)
prod_user_a.processing_status = Product.ProcessingStatus.REQUIRES_REVIEW
prod_user_a.decision_status = Product.DecisionStatus.REQUIRES_REVIEW
prod_user_a.save()

r_appr = admin_client.post(f'/api/classifications/{cls_a.id}/approve/', content_type='application/json')
assert r_appr.status_code == 200, f'Admin approve failed: {r_appr.data}'

prod_user_a.refresh_from_db()
assert prod_user_a.decision_status == Product.DecisionStatus.ADMIN_APPROVED, f'Decision status should be ADMIN_APPROVED, got {prod_user_a.decision_status}'
assert prod_user_a.processing_status == Product.ProcessingStatus.REQUIRES_REVIEW, 'Classification processing_status should remain untouched!'

r_sync_check = client.get('/api/products/')
items = r_sync_check.data.get('results', r_sync_check.data)
matched_prod = next(p for p in items if p['id'] == str(prod_user_a.id))
assert matched_prod['decision_status'] == 'ADMIN_APPROVED', f'User did not see live approved status: {matched_prod}'
print('TEST 7: Admin Approve -> DB updated -> User sees live Approved -> PASS')

# 8. Admin Decline on Product B
cls_b = ClassificationResult.objects.create(
    product=prod_user_b,
    taxonomy_version=tax_ver,
    category=tax_cat,
    confidence_score=0.35,
    status=ClassificationResult.ReviewStatus.PENDING_REVIEW
)
prod_user_b.processing_status = Product.ProcessingStatus.REQUIRES_REVIEW
prod_user_b.decision_status = Product.DecisionStatus.REQUIRES_REVIEW
prod_user_b.save()

r_decl = admin_client.post(f'/api/classifications/{cls_b.id}/reject/', {'reason': 'Category mismatch'}, content_type='application/json')
assert r_decl.status_code == 200, f'Admin reject failed: {r_decl.data}'

prod_user_b.refresh_from_db()
assert prod_user_b.decision_status == Product.DecisionStatus.ADMIN_DECLINED, f'Decision status should be ADMIN_DECLINED, got {prod_user_b.decision_status}'
assert prod_user_b.decline_reason == 'Category mismatch'
print('TEST 8: Admin Decline -> DB updated with reason -> Decision persists -> PASS')

cat_user_a.delete()
cat_user_b.delete()
User.objects.filter(username__in=['user_a@test.com', 'user_b@test.com']).delete()

print('=== ALL ROLE-BASED & SYNC TESTS PASSED! ===')
