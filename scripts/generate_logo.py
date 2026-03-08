#!/usr/bin/env python3
"""Generate all logo-derived assets from the single-source master image.

Usage:
    python scripts/generate_logo.py

Source: noheir.png (root directory, high-res transparent RGBA)

Generates:
    public/logo/logo-32.png         (32x32)
    public/logo/logo-64.png         (64x64)
    public/logo/logo-128.png        (128x128)
    public/logo/logo-180.png        (180x180, apple-touch-icon)
    public/logo/logo-192.png        (192x192, PWA icon)
    public/logo/logo-256.png        (256x256)
    public/logo-loading.png         (256x256 copy for splash screen)
    public/favicon.png              (32x32 PNG favicon)
    public/favicon.ico              (multi-size ICO: 16+32)
    public/opengraph-image.png      (1200x630, brand bg + centered logo, RGB)
"""

import os
from pathlib import Path

from PIL import Image

SOURCE = "noheir.png"
OUTPUT_DIR = "public/logo"
PUBLIC_DIR = "public"

# Brand background color (matches theme-color in index.html / manifest.json)
BRAND_BG = (59, 90, 149)  # #3b5a95

SIZES = {
    "32": (32, 32),
    "64": (64, 64),
    "128": (128, 128),
    "180": (180, 180),
    "192": (192, 192),
    "256": (256, 256),
}


def main():
    if not os.path.isfile(SOURCE):
        print(f"Error: '{SOURCE}' not found in project root")
        raise SystemExit(1)

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    img = Image.open(SOURCE)

    # --- Component logos (public/logo/) ---
    for name, size in SIZES.items():
        resized = img.resize(size, Image.Resampling.LANCZOS)
        output_path = os.path.join(OUTPUT_DIR, f"logo-{name}.png")
        resized.save(output_path, "PNG", optimize=True)
        print(f"Generated: {output_path}")

    # --- Loading logo (256x256) for splash screen ---
    loading_path = os.path.join(PUBLIC_DIR, "logo-loading.png")
    loading = img.resize((256, 256), Image.Resampling.LANCZOS)
    loading.save(loading_path, "PNG", optimize=True)
    print(f"Generated: {loading_path}")

    # --- PNG favicon (32x32) ---
    favicon_png_path = os.path.join(PUBLIC_DIR, "favicon.png")
    favicon_32 = img.resize((32, 32), Image.Resampling.LANCZOS)
    favicon_32.save(favicon_png_path, "PNG", optimize=True)
    print(f"Generated: {favicon_png_path}")

    # --- ICO favicon (multi-size: 16+32) ---
    favicon_ico_path = os.path.join(PUBLIC_DIR, "favicon.ico")
    favicon_16 = img.resize((16, 16), Image.Resampling.LANCZOS)
    favicon_32_ico = img.resize((32, 32), Image.Resampling.LANCZOS)
    favicon_16.save(
        favicon_ico_path,
        format="ICO",
        append_images=[favicon_32_ico],
        sizes=[(16, 16), (32, 32)],
    )
    print(f"Generated: {favicon_ico_path}")

    # --- OG Image (1200x630, brand background, centered logo, RGB) ---
    og_width, og_height = 1200, 630
    og_canvas = Image.new("RGB", (og_width, og_height), BRAND_BG)

    # Center logo at ~40% canvas height, scaled to fit nicely
    logo_size = int(og_height * 0.55)  # ~347px
    logo_resized = img.resize((logo_size, logo_size), Image.Resampling.LANCZOS)

    # Convert RGBA -> RGB by compositing onto brand background
    if logo_resized.mode == "RGBA":
        logo_bg = Image.new("RGBA", logo_resized.size, (*BRAND_BG, 255))
        logo_composited = Image.alpha_composite(logo_bg, logo_resized)
        logo_resized = logo_composited.convert("RGB")

    # Paste centered (vertically at ~40% height)
    x = (og_width - logo_size) // 2
    y = int(og_height * 0.40) - logo_size // 2
    og_canvas.paste(logo_resized, (x, y))

    og_path = os.path.join(PUBLIC_DIR, "opengraph-image.png")
    og_canvas.save(og_path, "PNG", optimize=True)
    print(f"Generated: {og_path}")

    print("\nAll logo assets generated successfully!")


if __name__ == "__main__":
    main()
