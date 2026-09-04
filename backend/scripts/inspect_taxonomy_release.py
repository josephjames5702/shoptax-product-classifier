import os
import sys
import json
import gzip
import hashlib
import urllib.request

def main():
    print("Checking Shopify product-taxonomy releases...", flush=True)
    cache_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "taxonomy_cache")
    os.makedirs(cache_dir, exist_ok=True)
    
    url = "https://api.github.com/repos/Shopify/product-taxonomy/releases/tags/v2026-08"
    req = urllib.request.Request(url, headers={"User-Agent": "ShopifyTaxonomyImporter/1.0", "Accept": "application/vnd.github.v3+json"})
    
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        print(f"Error fetching release: {e}", flush=True)
        return
        
    print(f"Release Tag: {data.get('tag_name')}", flush=True)
    print(f"Release Name: {data.get('name')}", flush=True)
    print(f"Prerelease (Unstable): {data.get('prerelease')}", flush=True)
    print(f"Published At: {data.get('published_at')}", flush=True)
    print(f"Total Assets: {len(data.get('assets', []))}", flush=True)
    
    assets = {a['name']: a['browser_download_url'] for a in data.get('assets', [])}
    
    key_assets = [
        "taxonomy.en.json.gz",
        "categories.en.json.gz",
        "attributes.en.json.gz",
        "values.en.json.gz",
        "categories.en.txt.gz",
        "integrations.all_mappings.en.json.gz"
    ]
    
    print("\n--- Key Assets Presence ---", flush=True)
    for k in key_assets:
        if k in assets:
            print(f"FOUND: {k} -> {assets[k]}", flush=True)
        else:
            print(f"MISSING: {k}", flush=True)
            
    # Download key files if not already cached
    to_download = [k for k in ["categories.en.json.gz", "attributes.en.json.gz", "taxonomy.en.json.gz"] if k in assets]
    
    downloaded_files = {}
    for asset_name in to_download:
        dest_path = os.path.join(cache_dir, asset_name)
        download_url = assets[asset_name]
        
        if os.path.exists(dest_path) and os.path.getsize(dest_path) > 0:
            print(f"\nUsing cached {asset_name} ({os.path.getsize(dest_path)} bytes)", flush=True)
            with open(dest_path, "rb") as f:
                content = f.read()
        else:
            print(f"\nDownloading {asset_name} from {download_url} ...", flush=True)
            dl_req = urllib.request.Request(download_url, headers={"User-Agent": "ShopifyTaxonomyImporter/1.0"})
            with urllib.request.urlopen(dl_req, timeout=60) as resp:
                content = resp.read()
            with open(dest_path, "wb") as f:
                f.write(content)
            print(f"Saved {asset_name} ({len(content)} bytes)", flush=True)
            
        sha256 = hashlib.sha256(content).hexdigest()
        print(f"SHA256 of {asset_name}: {sha256}", flush=True)
        downloaded_files[asset_name] = (dest_path, content)
        
    # Inspect schemas
    for asset_name, (dest_path, content) in downloaded_files.items():
        print(f"\n==========================================", flush=True)
        print(f"INSPECTING SCHEMA: {asset_name}", flush=True)
        print(f"==========================================", flush=True)
        try:
            decompressed = gzip.decompress(content).decode('utf-8')
            parsed = json.loads(decompressed)
            
            if isinstance(parsed, dict):
                print(f"Top-level type: DICT with keys: {list(parsed.keys())}", flush=True)
                for k, v in parsed.items():
                    if isinstance(v, list):
                        print(f"  Key '{k}': List of {len(v)} items. First item sample:", flush=True)
                        if len(v) > 0:
                            print("  " + json.dumps(v[0], indent=4)[:500], flush=True)
                    elif isinstance(v, dict):
                        print(f"  Key '{k}': Dict with keys {list(v.keys())}", flush=True)
                    else:
                        print(f"  Key '{k}': {v}", flush=True)
            elif isinstance(parsed, list):
                print(f"Top-level type: LIST of {len(parsed)} items. First item sample:", flush=True)
                if len(parsed) > 0:
                    print("  " + json.dumps(parsed[0], indent=4)[:600], flush=True)
        except Exception as e:
            print(f"Error inspecting {asset_name}: {e}", flush=True)

if __name__ == "__main__":
    main()
