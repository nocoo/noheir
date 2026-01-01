#!/usr/bin/env python3
"""Convert #3b5a95 to HSL"""

def hex_to_hsl_hex(hex_color):
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

# New primary color
new_primary = "#3b5a95"
hsl = hex_to_hsl_hex(new_primary)

print(f"Primary color: {new_primary}")
print(f"HSL: {hsl}")
print()
print("CSS variable: --primary: " + hsl + ";")
