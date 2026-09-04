import os
import json
import gzip

cache_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "taxonomy_cache")
cat_path = os.path.join(cache_dir, "categories.en.json.gz")
attr_path = os.path.join(cache_dir, "attributes.en.json.gz")
tax_path = os.path.join(cache_dir, "taxonomy.en.json.gz")

with gzip.open(cat_path, "rt", encoding="utf-8") as f:
    cat_data = json.load(f)

with gzip.open(attr_path, "rt", encoding="utf-8") as f:
    attr_data = json.load(f)

print("Version in categories:", cat_data.get("version"))
print("Number of verticals:", len(cat_data.get("verticals", [])))

total_categories = 0
categories_with_attrs = []
levels = set()
for v in cat_data.get("verticals", []):
    cats = v.get("categories", [])
    total_categories += len(cats)
    for c in cats:
        levels.add(c.get("level"))
        if c.get("attributes"):
            categories_with_attrs.append(c)

print(f"Total categories across all verticals: {total_categories}")
print(f"Levels present: {sorted(list(levels))}")
print(f"Categories with attributes: {len(categories_with_attrs)}")

if categories_with_attrs:
    sample = categories_with_attrs[0]
    print("\nSample category with attributes:")
    print("ID:", sample.get("id"))
    print("Level:", sample.get("level"))
    print("Name:", sample.get("name"))
    print("Full Name:", sample.get("full_name"))
    print("Parent ID:", sample.get("parent_id"))
    print("Attributes field type:", type(sample.get("attributes")), "Sample element:", sample.get("attributes")[0] if sample.get("attributes") else None)
    print("Return reasons field type:", type(sample.get("return_reasons")), "Sample:", sample.get("return_reasons")[:2] if sample.get("return_reasons") else None)

total_attributes = len(attr_data.get("attributes", []))
total_values = 0
for a in attr_data.get("attributes", []):
    total_values += len(a.get("values", []))

print(f"\nTotal attributes in attributes.en.json.gz: {total_attributes}")
print(f"Total attribute values: {total_values}")
print("Sample attribute details:")
print(json.dumps(attr_data.get("attributes", [])[0], indent=2))
