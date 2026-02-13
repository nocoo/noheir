#!/usr/bin/env python3
"""Generate different sizes of logo from a source image.

Usage:
    python scripts/generate_logo.py <input> <prefix>

Examples:
    python scripts/generate_logo.py logo-light.png light
    python scripts/generate_logo.py logo-dark.png dark

Generates:
    public/logo/<prefix>-32.png   (32x32)
    public/logo/<prefix>-64.png   (64x64)
    public/logo/<prefix>-128.png  (128x128)
    public/logo/<prefix>-256.png  (256x256)

With --favicon flag (only needed once, for light variant):
    python scripts/generate_logo.py logo-light.png light --favicon
    public/favicon.png             (32x32 PNG)
    public/logo-loading-<prefix>.png  (256x256 copy for splash screen)
"""

import sys
import os
from PIL import Image


def main():
    if len(sys.argv) < 3:
        print("Usage: python scripts/generate_logo.py <input> <prefix> [--favicon]")
        sys.exit(1)

    input_file = sys.argv[1]
    prefix = sys.argv[2]
    gen_favicon = "--favicon" in sys.argv

    if not os.path.isfile(input_file):
        print(f"Error: '{input_file}' not found")
        sys.exit(1)

    output_dir = "public/logo"
    os.makedirs(output_dir, exist_ok=True)

    img = Image.open(input_file)

    sizes = {
        "32": (32, 32),
        "64": (64, 64),
        "128": (128, 128),
        "256": (256, 256),
    }

    for name, size in sizes.items():
        resized = img.resize(size, Image.Resampling.LANCZOS)
        output_path = os.path.join(output_dir, f"{prefix}-{name}.png")
        resized.save(output_path, "PNG", optimize=True)
        print(f"Generated: {output_path}")

    # Loading logo (256x256) for splash screen
    loading_path = os.path.join("public", f"logo-loading-{prefix}.png")
    loading = img.resize((256, 256), Image.Resampling.LANCZOS)
    loading.save(loading_path, "PNG", optimize=True)
    print(f"Generated: {loading_path}")

    if gen_favicon:
        # PNG favicon (32x32)
        favicon_png = os.path.join("public", "favicon.png")
        favicon = img.resize((32, 32), Image.Resampling.LANCZOS)
        favicon.save(favicon_png, "PNG", optimize=True)
        print(f"Generated: {favicon_png}")

    print(f"\nAll {prefix} logos generated successfully!")


if __name__ == "__main__":
    main()
