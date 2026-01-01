#!/usr/bin/env python3
"""Extract dominant color from logo.png"""

from PIL import Image
import sys

# Open the logo
img = Image.open("logo.png")

# Resize to 1x1 to get average color
small_img = img.resize((1, 1))
avg_color = small_img.getpixel((0, 0))

# Get color from corners (logo likely has gradient)
top_left = img.getpixel((100, 100))
bottom_right = img.getpixel((img.width - 100, img.height - 100))
center = img.getpixel((img.width // 2, img.height // 2))

print(f"Average color: rgb{avg_color}")
print(f"Top-left (darker): rgb{top_left}")
print(f"Bottom-right (lighter): rgb{bottom_right}")
print(f"Center: rgb{center}")
print()

def rgb_to_hex(rgb):
    """Convert RGB to hex"""
    if len(rgb) == 4:  # RGBA
        rgb = rgb[:3]
    return '#{:02x}{:02x}{:02x}'.format(*rgb)

print(f"Average: {rgb_to_hex(avg_color)}")
print(f"Top-left (recommended primary): {rgb_to_hex(top_left)}")
print(f"Bottom-right: {rgb_to_hex(bottom_right)}")
print(f"Center: {rgb_to_hex(center)}")
