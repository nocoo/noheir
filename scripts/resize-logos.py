#!/usr/bin/env python3
"""Resize logo.png -> public/ assets (Vite SPA variant).

Single source: logo.png (project root, 2048x2048 RGBA PNG)

Standard outputs (B-3 spec):
    public/logo-24.png          (24x24, sidebar header)
    public/logo-80.png          (80x80, login avatar, about page)
    public/favicon.ico          (multi-size ICO: 16+32)

Extended outputs (PWA / social):
    public/logo-32.png          (32x32, favicon fallback)
    public/logo-64.png          (64x64)
    public/logo-128.png         (128x128)
    public/logo-180.png         (180x180, apple-touch-icon)
    public/logo-192.png         (192x192, PWA manifest)
    public/logo-256.png         (256x256, loading splash)
    public/opengraph-image.png  (1200x630, OG/Twitter card)

Usage:
    python scripts/resize-logos.py
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "logo.png"
PUBLIC = ROOT / "public"

# Brand background color (matches theme-color in index.html / manifest.json)
BRAND_BG = (59, 90, 149)  # #3b5a95

SIZES = {
    "logo-24.png": 24,
    "logo-32.png": 32,
    "logo-64.png": 64,
    "logo-80.png": 80,
    "logo-128.png": 128,
    "logo-180.png": 180,
    "logo-192.png": 192,
    "logo-256.png": 256,
}


def main():
    if not SRC.is_file():
        print(f"Error: '{SRC}' not found")
        raise SystemExit(1)

    img = Image.open(SRC).convert("RGBA")

    # --- Sized PNGs ---
    for name, size in SIZES.items():
        out = img.resize((size, size), Image.LANCZOS)
        out.save(PUBLIC / name, "PNG", optimize=True)
        print(f"  {name} ({size}x{size})")

    # --- favicon.ico (multi-size: 16+32) ---
    ico_16 = img.resize((16, 16), Image.LANCZOS)
    ico_32 = img.resize((32, 32), Image.LANCZOS)
    ico_16.save(
        PUBLIC / "favicon.ico",
        format="ICO",
        append_images=[ico_32],
        sizes=[(16, 16), (32, 32)],
    )
    print("  favicon.ico (16+32)")

    # --- OG Image (1200x630, brand background, centered logo, RGB) ---
    og_w, og_h = 1200, 630
    canvas = Image.new("RGB", (og_w, og_h), BRAND_BG)

    logo_size = int(og_h * 0.55)
    logo_resized = img.resize((logo_size, logo_size), Image.LANCZOS)
    if logo_resized.mode == "RGBA":
        bg = Image.new("RGBA", logo_resized.size, (*BRAND_BG, 255))
        logo_resized = Image.alpha_composite(bg, logo_resized).convert("RGB")

    x = (og_w - logo_size) // 2
    y = int(og_h * 0.40) - logo_size // 2
    canvas.paste(logo_resized, (x, y))
    canvas.save(PUBLIC / "opengraph-image.png", "PNG", optimize=True)
    print("  opengraph-image.png (1200x630)")

    print("\nAll logo assets generated successfully!")


if __name__ == "__main__":
    main()
