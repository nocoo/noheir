#!/usr/bin/env python3
"""
Generate a favicon for 个人财务管理 (Personal Finance Management)
Design: A stylized coin/chart symbol representing financial tracking
"""

import base64
from pathlib import Path

def generate_favicon_svg():
    """Generate an SVG favicon with a financial chart design"""
    svg = '''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <!-- Background circle -->
  <circle cx="32" cy="32" r="30" fill="#059669"/>

  <!-- Coin outer ring -->
  <circle cx="32" cy="32" r="26" fill="none" stroke="#10B981" stroke-width="2"/>

  <!-- Inner circle -->
  <circle cx="32" cy="32" r="20" fill="#065F46"/>

  <!-- Chinese Yuan symbol (¥) -->
  <g fill="#34D399">
    <!-- Vertical line -->
    <rect x="30" y="18" width="4" height="28" rx="1"/>
    <!-- Top horizontal line -->
    <rect x="20" y="22" width="24" height="3" rx="1"/>
    <!-- Middle horizontal line -->
    <rect x="22" y="28" width="20" height="3" rx="1"/>
    <!-- Bottom legs -->
    <polygon points="30,40 28,46 32,46 36,46 34,40"/>
  </g>

  <!-- Decorative dots -->
  <circle cx="16" cy="32" r="2" fill="#10B981" opacity="0.8"/>
  <circle cx="48" cy="32" r="2" fill="#10B981" opacity="0.8"/>
  <circle cx="32" cy="16" r="2" fill="#10B981" opacity="0.8"/>
  <circle cx="32" cy="48" r="2" fill="#10B981" opacity="0.8"/>
</svg>'''
    return svg

def generate_favicon_png():
    """Generate a simple PNG favicon using Python PIL if available"""
    try:
        from PIL import Image, ImageDraw, ImageFont
        import io

        # Create image with green background
        size = 64
        img = Image.new('RGBA', (size, size), (5, 150, 105, 255))
        draw = ImageDraw.Draw(img)

        # Draw outer ring
        draw.ellipse([2, 2, size-2, size-2], outline=(16, 185, 129, 255), width=2)

        # Draw inner circle
        draw.ellipse([12, 12, size-12, size-12], fill=(6, 95, 70, 255))

        # Draw ¥ symbol
        # Vertical line
        draw.rectangle([29, 16, 35, 46], fill=(52, 211, 153, 255))
        # Top line
        draw.rectangle([18, 21, 46, 25], fill=(52, 211, 153, 255))
        # Middle line
        draw.rectangle([20, 28, 44, 32], fill=(52, 211, 153, 255))

        # Save to bytes
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='PNG')
        img_bytes.seek(0)

        return img_bytes.read()
    except ImportError:
        return None

def main():
    output_dir = Path(__file__).parent.parent / 'public'
    output_dir.mkdir(exist_ok=True)

    # Generate SVG favicon
    svg_content = generate_favicon_svg()
    svg_path = output_dir / 'favicon.svg'
    svg_path.write_text(svg_content, encoding='utf-8')
    print(f"✓ Generated SVG favicon: {svg_path}")

    # Try to generate PNG/ICO if PIL is available
    try:
        from PIL import Image

        png_data = generate_favicon_png()
        if png_data:
            # Save PNG
            png_path = output_dir / 'favicon-64x64.png'
            png_path.write_bytes(png_data)
            print(f"✓ Generated PNG favicon: {png_path}")

            # Generate ICO
            img = Image.open(io.BytesIO(png_data))
            ico_path = output_dir / 'favicon.ico'
            img.save(ico_path, format='ICO', sizes=[(32, 32), (64, 64)])
            print(f"✓ Generated ICO favicon: {ico_path}")
    except ImportError:
        print("⚠ PIL not available, only SVG favicon generated")
        print("  Install with: pip install pillow")

    print("\n✨ Favicon generation complete!")

if __name__ == '__main__':
    main()
