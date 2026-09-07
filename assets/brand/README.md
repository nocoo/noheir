# Noheir logo assets

The original animal is retained byte-for-byte. This Refined pass adds the quiet terraces background, fine grain, and shallow contact shadows. No image model was called. The transparent foreground keeps its original pose, colors, anatomy, and native canvas.

## Asset roles

| Surface | Asset | Treatment |
| --- | --- | --- |
| README header | `assets/brand/icon-rounded.png` | Selected presentation at 128 px |
| Expanded / collapsed sidebar | `public/logo-24.png` | Transparent original without additional crop |
| Login badge | `public/logo-80.png` | Transparent original; circular clipping and decorative avatar backing removed |
| Browser icons | `public/logo-32.png; public/favicon.ico` | Metadata declares the transparent PNG and decoded 16/32 px ICO |
| Apple touch | `public/logo-180.png` | Square presentation at 180 px, declared in root metadata |
| Installed app | `public/logo-192.png; public/icon-512.png` | Opaque presentations declared as purpose any; the retained full composition is not declared maskable |
| Open Graph | `public/opengraph-image.png` | Rounded presentation on the existing 1200 × 630 blue canvas, declared in root metadata |

Root `logo.png` remains the canonical 2048 × 2048 transparent master. `icon.png` and `icon-rounded.png` in this directory are separate square and rounded presentations at the same native dimensions. Small UI marks use the foreground with no external glow, added background, or circular crop. Localized and package READMEs were checked for additional logo headers.

## Reproduce and verify

```sh
uv run --with pillow python scripts/resize-logos.py
```

The exact source, sampled palette, independent background layers, every export size, and frozen finishing recipe are archived in `nocoo/hexly.ai` under `artwork/logo-family/noheir/2026-09-07-01/finishing/01`. [source.json](source.json) records provenance and all master SHA-256 values. The separate UI theme palette is unchanged.

- [Individual logo review](https://hexly.ai/logos/noheir)
- [Local static review](https://index.dev.hexly.ai/artwork/logo-family/noheir/2026-09-07-01/review.html)
- [Shared logo usage SOP](https://github.com/nocoo/hexly.ai/blob/main/docs/07-logo-usage-sop.md)

Before/after deliberately shares the same original foreground. Verify small marks at their actual displayed sizes on both themes, decode every ICO resolution, and keep any platform-specific mask separate from the transparent source.
