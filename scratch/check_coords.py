from PIL import Image

im = Image.open(r'frontend\public\images\admin-floating-bg.png')
w, h = im.size

# Let's inspect coordinates on the right side of the card (around x: 500 to 800, y: 150 to 450)
print(f"Total image dimensions: {w}x{h}")
