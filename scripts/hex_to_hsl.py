#!/usr/bin/env python3
"""Convert logo color to HSL for CSS variables"""

def hex_to_hsl(hex_color):
    """Convert hex color to HSL"""
    hex_color = hex_color.lstrip('#')
    r, g, b = tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

    r, g, b = r / 255.0, g / 255.0, b / 255.0

    max_c = max(r, g, b)
    min_c = min(r, g, b)
    delta = max_c - min_c

    # Hue
    if delta == 0:
        h = 0
    elif max_c == r:
        h = 60 * (((g - b) / delta) % 6)
    elif max_c == g:
        h = 60 * (((b - r) / delta) + 2)
    else:
        h = 60 * (((r - g) / delta) + 4)

    # Lightness
    l = (max_c + min_c) / 2

    # Saturation
    if delta == 0:
        s = 0
    else:
        s = delta / (1 - abs(2 * l - 1))

    h = round(h)
    s = round(s * 100)
    l = round(l * 100)

    return f"{h} {s}% {l}%"

# Logo colors from analysis
logo_colors = {
    "primary (top-left)": "#3b5894",
    "lighter variant": "#4a6bb0",
    "much lighter": "#6d82ad",
}

print("CSS HSL values for logo colors:")
print("=" * 50)
for name, hex_color in logo_colors.items():
    hsl = hex_to_hsl(hex_color)
    print(f"{name:25s}: {hex_color} -> {hsl}")
print()

# Primary color suggestions
primary = hex_to_hsl("#3b5894")
primary_light = hex_to_hsl("#6d82ad")
primary_dark = hex_to_hsl("#2a4580")

print("Recommended CSS variables:")
print("=" * 50)
print(f"--primary: {primary};           /* Main logo color */")
print(f"--primary-light: {primary_light};   /* Lighter variant */")
print(f"--primary-dark: {primary_dark};     /* Darker variant */")
