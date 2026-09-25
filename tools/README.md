# tools/

Build-time scripts. The site itself is static (`index.html` + `assets/`) and needs no build step
to serve; these only regenerate the committed assets.

```bash
cd tools && npm install
pip install fonttools brotli
```

| Command | Output | When |
|---|---|---|
| `npm run bake -- <source.glb> ../assets/models/gown.glb` | `assets/models/gown.glb` | Model changes |
| `npm run vendor` | `assets/js/three.vendor.js` | Upgrading three.js or `stage.js` imports something new (add it to `three-vendor-entry.js`) |
| `npm run fonts` | `assets/fonts/*.woff2` | Copy in `index.html` changes (Japanese display font is subset to the glyphs used) |

## Model pipeline (`bake-gown.mjs`)

The source model (Tripo export, 3.9 MB) has 168 parts, each with its own material and texture —
168 draw calls. The bake:

1. packs all 168 textures into one atlas (with 4 px edge-extended gutters) and remaps UVs,
2. classifies each part by the average hue of its texture; celadon silk parts get a `_DYE = 1`
   vertex attribute, which the colorway shader in `assets/js/stage.js` uses as its mask,
3. joins everything into one mesh, quantizes, and applies meshopt compression.

Result: 1.1 MB, 1 draw call. `KHR_materials_volume` and `FB_ngon_encoding` from the source are dropped.

## Static fallback image

`assets/img/gown-poster.webp` is a capture of the live canvas at 899×1199 CSS px
(no-WebGL / pre-load fallback). If lighting or the hero camera changes, re-capture it so the
hand-off from image to live canvas stays seamless.
