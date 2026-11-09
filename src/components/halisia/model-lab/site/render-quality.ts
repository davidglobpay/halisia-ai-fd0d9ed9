/**
 * Picture quality for the site viewer, all built into three.js (no extra
 * packages, no service):
 * - daylight from a real photographed sky (an HDR image) instead of a
 *   synthetic studio, so materials pick up true sky colour and reflections;
 * - finishing effects: soft contact shadows where things meet (ambient
 *   occlusion), a gentle glow on lit lamps (bloom), and smooth edges (MSAA);
 * - a film grade, as a photographer would finish a picture: a soft contrast
 *   curve, warm highlights and cool shadows, a light vignette and fine grain.
 * The effects cost GPU time, so the viewer switches them off on phones by
 * default and always in VR, where the plain renderer is used.
 */
import * as THREE from "three";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

/**
 * Film grade, applied after tone mapping (display colours). Kept gentle: the
 * aim is a photograph, not a filter. `amount` 0 leaves the picture untouched.
 */
export const FilmGradeShader = {
  name: "FilmGradeShader",
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    amount: { value: 1.0 },
    time: { value: 0.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float amount;
    uniform float time;
    varying vec2 vUv;
    float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec4 src = texture2D(tDiffuse, vUv);
      vec3 c = src.rgb;
      // Soft S-curve for depth.
      c = mix(c, c * c * (3.0 - 2.0 * c), 0.22 * amount);
      // Warm highlights, cool shadows.
      float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(c, c * vec3(1.045, 1.0, 0.94), smoothstep(0.35, 1.0, lum) * amount);
      c = mix(c, c * vec3(0.95, 0.99, 1.06), (1.0 - smoothstep(0.0, 0.45, lum)) * 0.7 * amount);
      // Light vignette.
      float v = smoothstep(0.95, 0.3, length((vUv - 0.5) * vec2(1.1, 1.0)));
      c *= mix(1.0 - 0.28 * amount, 1.0, v);
      // Fine grain, moving with time so it reads as film, not dirt.
      float n = rand(vUv * 1000.0 + fract(time) * 17.0) - 0.5;
      c += n * 0.022 * amount;
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), src.a);
    }`,
};

/** "Quarry 01" (Poly Haven, CC0): a clear, sunny open-country sky. */
export const DAY_SKY_URL = "/site-assets/sky-day.hdr";

/** Load the day sky as an environment light. Resolves null on failure. */
export async function loadSkyEnvironment(
  renderer: THREE.WebGLRenderer,
  url = DAY_SKY_URL,
): Promise<THREE.Texture | null> {
  try {
    const hdr = await new HDRLoader().setDataType(THREE.FloatType).loadAsync(url);
    neutraliseGround(hdr);
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromEquirectangular(hdr).texture;
    pmrem.dispose();
    hdr.dispose();
    return env;
  } catch {
    return null;
  }
}

/**
 * The photo's lower half is the photographer's own ground (here brown
 * quarry earth), which would tint every ceiling and soffit. The real ground
 * is the satellite terrain, so the lower half is turned to a neutral, light
 * grey of the same brightness: true sky above, honest bounce light below.
 */
function neutraliseGround(tex: THREE.DataTexture) {
  const { data, width, height } = tex.image as {
    data: Float32Array;
    width: number;
    height: number;
  };
  if (!(data instanceof Float32Array)) return;
  // Equirectangular rows run top (sky) to bottom (ground); blend from the
  // horizon down so there is no seam.
  for (let y = Math.floor(height * 0.48); y < height; y++) {
    const t = Math.min(1, (y - height * 0.48) / (height * 0.06));
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      for (let c = 0; c < 3; c++) data[i + c] += (lum * 1.1 - data[i + c]) * t * 0.85;
    }
  }
  tex.needsUpdate = true;
}

export type Finisher = {
  composer: EffectComposer;
  render: (camera: THREE.Camera) => void;
  setSize: (w: number, h: number, pixelRatio: number) => void;
  /** Bloom only matters when lamps are lit; skipping it saves time by day. */
  setNight: (night: boolean) => void;
  /** Film grade strength, 0 (off) to 1. */
  setGrade: (amount: number) => void;
  dispose: () => void;
};

export function createFinisher(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
): Finisher {
  const target = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    samples: 4,
  });
  const composer = new EffectComposer(renderer, target);
  const renderPass = new RenderPass(scene, camera);
  const ao = new GTAOPass(scene, camera, 1, 1);
  ao.output = GTAOPass.OUTPUT.Default;
  ao.blendIntensity = 0.8;
  ao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 1, scale: 1 });
  ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.35, 0.4, 0.92);
  bloom.enabled = false;
  const output = new OutputPass();
  const grade = new ShaderPass(FilmGradeShader);
  composer.addPass(renderPass);
  composer.addPass(ao);
  composer.addPass(bloom);
  composer.addPass(output);
  composer.addPass(grade);
  return {
    composer,
    render(cam) {
      renderPass.camera = cam;
      ao.camera = cam;
      grade.uniforms.time.value = (performance.now() / 1000) % 1000;
      composer.render();
    },
    setSize(w, h, pixelRatio) {
      composer.setPixelRatio(pixelRatio);
      composer.setSize(w, h);
    },
    setNight(night) {
      bloom.enabled = night;
    },
    setGrade(amount) {
      grade.uniforms.amount.value = amount;
      grade.enabled = amount > 0;
    },
    dispose() {
      ao.dispose();
      bloom.dispose();
      output.dispose();
      grade.dispose();
      composer.dispose();
    },
  };
}
