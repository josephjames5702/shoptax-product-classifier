import shutil
import os

brain_dir = r"C:\Users\josep\.gemini\antigravity-ide\brain\1783505d-43e8-43d8-8143-92f2ac63c21b"
public_images = r"c:\Users\josep\OneDrive\project 2\frontend\public\images"

src1 = os.path.join(brain_dir, ".user_uploaded", "media_1788494637259.png")
dst1 = os.path.join(public_images, "cinematic_reference.png")
shutil.copy2(src1, dst1)
print(f"Copied reference: {os.path.getsize(dst1)} bytes")

src2 = os.path.join(brain_dir, "office_login_bg_1788494721269.jpg")
dst2 = os.path.join(public_images, "office_bg.jpg")
shutil.copy2(src2, dst2)
print(f"Copied office_bg: {os.path.getsize(dst2)} bytes")
