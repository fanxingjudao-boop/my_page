// Entry for assets/js/three.vendor.js — only what assets/js/stage.js uses.
// Rebuild: see tools/README.md
export {
  WebGLRenderer, Scene, PerspectiveCamera, PMREMGenerator, Color, Vector3,
  SpotLight, DirectionalLight, Mesh, PlaneGeometry, ShadowMaterial, MeshBasicMaterial,
  CanvasTexture, BufferGeometry, BufferAttribute, Points, ShaderMaterial, Group,
  ACESFilmicToneMapping, SRGBColorSpace, PCFShadowMap, MathUtils,
} from 'three';
export { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
export { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
export { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
