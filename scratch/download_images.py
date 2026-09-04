import urllib.request
import os

images_dir = os.path.join(r"c:\Users\josep\OneDrive\project 2\frontend\public\images")
os.makedirs(images_dir, exist_ok=True)

urls = {
    "sofa-main.jpg": "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=600&q=80",
    "dining-table.jpg": "https://images.unsplash.com/photo-1577140917170-285929fb55b7?auto=format&fit=crop&w=600&q=80",
    "dining-chairs.jpg": "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=600&q=80",
    "table-detail.jpg": "https://images.unsplash.com/photo-1533090161767-e6ffed986c88?auto=format&fit=crop&w=500&q=80",
    "side-table.jpg": "https://images.unsplash.com/photo-1532372320572-cda25653a26d?auto=format&fit=crop&w=500&q=80",
    "sectional-sofa.jpg": "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=600&q=80",
    "decor-plant.jpg": "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=600&q=80",
}

headers = {"User-Agent": "Mozilla/5.0"}
for name, url in urls.items():
    dest = os.path.join(images_dir, name)
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = resp.read()
            with open(dest, "wb") as f:
                f.write(data)
        print(f"Downloaded {name}: {len(data)} bytes")
    except Exception as e:
        print(f"Failed {name}: {e}")
