from PIL import Image
import numpy as np

im = Image.open(r'frontend\public\images\admin-floating-bg.png')
w, h = im.size

# Let's crop specific regions to check
# The right panel is roughly x from 520 to 760
# Let's check:
# 1. 'LOGIN ID' input box:
# 2. 'PASSWORD' input box:
# 3. 'SIGN IN' button:
# 4. 'Autofill Default Admin' button:
# 5. 'Return to Seller Portal' link:

arr = np.array(im.convert('RGB'))

# Find the blue sign-in button on the right side: x > 500, y > 280
blue_right = (arr[:, :, 0] < 50) & (arr[:, :, 1] > 110) & (arr[:, :, 2] > 180)
blue_right[:, :500] = False
y_btn, x_btn = np.where(blue_right)
print(f"Sign In Button: x={x_btn.min()}..{x_btn.max()} ({x_btn.min()/w*100:.2f}%..{x_btn.max()/w*100:.2f}%), y={y_btn.min()}..{y_btn.max()} ({y_btn.min()/h*100:.2f}%..{y_btn.max()/h*100:.2f}%)")

# Crop the form area (x: 520..760, y: 150..430) and inspect
form_area = im.crop((520, 150, 760, 430))
form_area.save(r'scratch/form_area.png')
print("Saved scratch/form_area.png")
