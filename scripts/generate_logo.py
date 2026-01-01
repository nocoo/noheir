#!/usr/bin/env python3
"""Generate different sizes of logo from the original logo.png"""

from PIL import Image
import os

# Original logo path
original_logo = "logo.png"
# Output directory
output_dir = "public/logo"

# Create output directory if it doesn't exist
os.makedirs(output_dir, exist_ok=True)

# Sizes to generate (name: (width, height))
sizes = {
    "32": (32, 32),
    "64": (64, 64),
    "128": (128, 128),
    "256": (256, 256),
}

# Open original logo
img = Image.open(original_logo)

# Generate different sizes
for name, size in sizes.items():
    resized = img.resize(size, Image.Resampling.LANCZOS)
    output_path = os.path.join(output_dir, f"logo-{name}.png")
    resized.save(output_path, "PNG", optimize=True)
    print(f"Generated: {output_path}")

# Also create favicon.ico (multi-size ico)
ico_sizes = [(16, 16), (32, 32), (64, 64)]
ico_path = os.path.join("public", "favicon-new.ico")
img.save(ico_path, format="ICO", sizes=ico_sizes)
print(f"Generated: {ico_path}")

print("\nAll logos generated successfully!")
