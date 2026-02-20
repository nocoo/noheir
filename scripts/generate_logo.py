#!/usr/bin/env python3
"""Generate different sizes of logo from a single transparent source image.

Usage:
    python scripts/generate_logo.py

Source: noheir.png (root directory, transparent background)

Generates:
    public/logo/logo-32.png    (32x32)
    public/logo/logo-64.png    (64x64)
    public/logo/logo-128.png   (128x128)
    public/logo/logo-256.png   (256x256)
    public/logo-loading.png    (256x256 copy for splash screen)
    public/favicon.png         (32x32 PNG)
"""

import os
from PIL import Image

SOURCE = "noheir.png"
OUTPUT_DIR = "public/logo"

SIZES = {
    "32": (32, 32),
    "64": (64, 64),
    "128": (128, 128),
    "256": (256, 256),
}


def main():
    if not os.path.isfile(SOURCE):
        print(f"Error: '{SOURCE}' not found in project root")
        raise SystemExit(1)

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    img = Image.open(SOURCE)

    for name, size in SIZES.items():
        resized = img.resize(size, Image.Resampling.LANCZOS)
        output_path = os.path.join(OUTPUT_DIR, f"logo-{name}.png")
        resized.save(output_path, "PNG", optimize=True)
        print(f"Generated: {output_path}")

    # Loading logo (256x256) for splash screen
    loading_path = os.path.join("public", "logo-loading.png")
    loading = img.resize((256, 256), Image.Resampling.LANCZOS)
    loading.save(loading_path, "PNG", optimize=True)
    print(f"Generated: {loading_path}")

    # PNG favicon (32x32)
    favicon_path = os.path.join("public", "favicon.png")
    favicon = img.resize((32, 32), Image.Resampling.LANCZOS)
    favicon.save(favicon_path, "PNG", optimize=True)
    print(f"Generated: {favicon_path}")

    print("\nAll logos generated successfully!")


if __name__ == "__main__":
    main()
