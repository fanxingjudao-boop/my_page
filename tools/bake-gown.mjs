// Bake per-part textures into one atlas, remap UVs, tag dyeable parts (_DYE), join into a single
// meshopt-compressed mesh.  Usage: node bake-gown.mjs <source.glb> <out.glb>
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { join, flatten, weld, prune, dedup, quantize, reorder } from '@gltf-transform/functions';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import { MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
const [,, inp, out, W = '4096', H = '4096'] = process.argv;
const AW = +W, AH = +H, G = 4; // gutter px on each side
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(inp);
const root = doc.getRoot();
const prims = root.listMeshes().flatMap(m => m.listPrimitives());
const tex = [...new Set(prims.map(p => p.getMaterial().getBaseColorTexture()))];
const items = tex.map(t => ({ t, w: t.getSize()[0], h: t.getSize()[1] })).sort((a, b) => b.h - a.h || b.w - a.w);
// shelf pack
let x = 0, y = 0, shelf = 0;
for (const it of items) {
  const w = it.w + 2 * G, h = it.h + 2 * G;
  if (x + w > AW) { x = 0; y += shelf; shelf = 0; }
  it.x = x + G; it.y = y + G; x += w; shelf = Math.max(shelf, h);
}
if (y + shelf > AH) throw new Error(`atlas overflow: need ${y + shelf}px height`);
console.log('atlas used height', y + shelf);
const layers = await Promise.all(items.map(async it => ({
  input: await sharp(Buffer.from(it.t.getImage())).extend({ top: G, bottom: G, left: G, right: G, extendWith: 'copy' }).toBuffer(),
  left: it.x - G, top: it.y - G,
})));
const atlasH = Math.pow(2, Math.ceil(Math.log2(y + shelf)));
const atlas = await sharp({ create: { width: AW, height: atlasH, channels: 3, background: '#000' } }).composite(layers).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
const pos = new Map(items.map(it => [it.t, it]));
// classify each part by the average colour of its texture: celadon silk parts are dyeable (_DYE = 1)
const hsv = ([r, g, b]) => {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, mx ? d / mx : 0, mx / 255];
};
const dyeable = new Map();
for (const it of items) {
  const { channels } = await sharp(Buffer.from(it.t.getImage())).stats();
  const [h, s, v] = hsv(channels.slice(0, 3).map(c => c.mean));
  dyeable.set(it.t, h > 47 && h < 215 && s > 0.035 ? 1 : 0);
  if (process.env.DEBUG) console.log(it.w, h.toFixed(0), s.toFixed(3), v.toFixed(2), dyeable.get(it.t));
}
const atlasTex = doc.createTexture('atlas').setImage(atlas).setMimeType('image/jpeg');
const mat = doc.createMaterial('gown').setBaseColorTexture(atlasTex).setRoughnessFactor(0.72).setMetallicFactor(0).setDoubleSided(true);
for (const p of prims) {
  const it = pos.get(p.getMaterial().getBaseColorTexture());
  const acc = p.getAttribute('TEXCOORD_0'); const a = acc.getArray().slice();
  for (let i = 0; i < a.length; i += 2) {
    a[i] = (it.x + a[i] * it.w) / AW;
    a[i + 1] = (it.y + a[i + 1] * it.h) / atlasH;
  }
  p.setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(a).setBuffer(acc.getBuffer()));
  const n = acc.getCount();
  p.setAttribute('_DYE', doc.createAccessor().setType('SCALAR').setArray(new Float32Array(n).fill(dyeable.get(p.getMaterial().getBaseColorTexture()))).setBuffer(acc.getBuffer()));
  p.setMaterial(mat);
}
for (const e of root.listExtensionsUsed()) if (e.extensionName === 'KHR_materials_volume') e.dispose();
await doc.transform(dedup(), flatten(), join({ keepNamed: false }), weld(), prune(),
  reorder({ encoder: MeshoptEncoder }), quantize({ quantizeNormal: 10, quantizeTexcoord: 14 }));
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: 'filter' });
await io.write(out, doc);
console.log('meshes', root.listMeshes().length, 'prims', root.listMeshes().flatMap(m => m.listPrimitives()).length, 'atlas', AW + 'x' + atlasH);
