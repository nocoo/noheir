# Noheir logo assets

The copper-and-cream cow keeps its gentle three-quarter face, horns, ears, blue eyes, and coral muzzle. Its short neck settles into a real shoulder entering the lower-right frame. The green Quiet terraces presentation is retained.

## Asset roles

| Surface | Asset | Treatment |
| --- | --- | --- |
| README header | `assets/brand/icon-rounded.png` | Selected presentation at 128 px |
| Both sidebar states | `public/logo-24.png` | Transparent artwork, no additional crop |
| Login | `public/logo-80.png` | Transparent artwork without circular masking |
| Browser | `public/logo-32.png`, `favicon.ico` | Transparent 32 px PNG and 16/32 px ICO, declared in metadata |
| Apple touch | `public/logo-180.png` | Opaque square presentation, 180 px |
| Installed app | `public/logo-{192,256}.png`, `icon-512.png` | Square presentations; manifest uses purpose any |
| Social | `public/opengraph-image.png` | Rounded presentation on the existing 1200 × 630 blue canvas |

Root `logo.png` is the canonical 2048 × 2048 transparent master. `icon.png` and `icon-rounded.png` in this directory are separate square and rounded presentations. Small app/browser marks use the foreground without external glow, extra backgrounds, filters, or circular masks. Independent user/provider identities remain separate.

## Reproduce and verify

```sh
uv run --with pillow python scripts/resize-logos.py
```

One Azure gpt-image-2 request produced native 2048 × 2048 artwork. Selected study/pass: `2026-09-07-02 / 02`. The protected face features and complete accessories have at least 148.5 native pixels of clearance from the actual 23% rounded outline; intentional lower shoulder/wing entries are measured separately. Source-colored continuation layers are archived behind the inset foreground where needed, with opaque accepted pixels preserved. The UI theme remains separate from the artwork palette.

[source.json](source.json) records the exact master hashes. Untouched generation, exact prompt, references, sampled palette, extraction, all ten export sizes, and frozen finishing layers are preserved in the [Hexly archive](https://github.com/nocoo/hexly.ai/tree/main/artwork/logo-family/noheir/2026-09-07-02).

- [Individual before/after review](https://hexly.ai/logos/noheir)
- [Local static review](https://index.dev.hexly.ai/artwork/logo-family/noheir/2026-09-07-02/review.html)
- [Shared logo usage SOP](https://github.com/nocoo/hexly.ai/blob/main/docs/07-logo-usage-sop.md)

Regenerate PNG and ICO consumers from these selected masters. Verify every ICO resolution and actual small marks on both themes, including both sidebar states.
