/**
 * Generates indicative massing models (glTF-binary + USDZ) for the HALISIA
 * architectural prototypes. Geometry is derived from the prototype's stored
 * footprint / height / floor count, so the model always matches the database
 * record it represents. These are *indicative massing volumes*, not
 * architectural design models — the UI must label them as such.
 *
 *   bun scripts/build-massing-models.mjs <outDir>
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

const PROTOTYPES = [
  { slug: "maridadi-4-bed-villa", footprint: 210, height: 7.5, floors: 2, ratio: 1.35 },
  { slug: "jenga-container-mall", footprint: 420, height: 6.5, floors: 2, ratio: 1.8 },
  { slug: "ghala-logistics-warehouse", footprint: 1200, height: 9, floors: 1, ratio: 2.2 },
  { slug: "sokoni-commercial-plaza", footprint: 640, height: 18, floors: 5, ratio: 1.2 },
  { slug: "nyumbani-apartment-block", footprint: 480, height: 21, floors: 6, ratio: 1.15 },
];

/* ------------------------------ geometry ------------------------------ */

/** Axis-aligned box as flat-shaded triangles (positions + normals + indices). */
function box(cx, cy, cz, w, h, d) {
  const x0 = cx - w / 2,
    x1 = cx + w / 2;
  const y0 = cy,
    y1 = cy + h;
  const z0 = cz - d / 2,
    z1 = cz + d / 2;
  const faces = [
    {
      n: [0, 0, 1],
      v: [
        [x0, y0, z1],
        [x1, y0, z1],
        [x1, y1, z1],
        [x0, y1, z1],
      ],
    },
    {
      n: [0, 0, -1],
      v: [
        [x1, y0, z0],
        [x0, y0, z0],
        [x0, y1, z0],
        [x1, y1, z0],
      ],
    },
    {
      n: [1, 0, 0],
      v: [
        [x1, y0, z1],
        [x1, y0, z0],
        [x1, y1, z0],
        [x1, y1, z1],
      ],
    },
    {
      n: [-1, 0, 0],
      v: [
        [x0, y0, z0],
        [x0, y0, z1],
        [x0, y1, z1],
        [x0, y1, z0],
      ],
    },
    {
      n: [0, 1, 0],
      v: [
        [x0, y1, z1],
        [x1, y1, z1],
        [x1, y1, z0],
        [x0, y1, z0],
      ],
    },
    {
      n: [0, -1, 0],
      v: [
        [x0, y0, z0],
        [x1, y0, z0],
        [x1, y0, z1],
        [x0, y0, z1],
      ],
    },
  ];
  const pos = [];
  const nor = [];
  const idx = [];
  for (const f of faces) {
    const base = pos.length / 3;
    for (const v of f.v) {
      pos.push(...v);
      nor.push(...f.n);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return { pos, nor, idx };
}

function merge(parts) {
  const pos = [];
  const nor = [];
  const idx = [];
  for (const p of parts) {
    const base = pos.length / 3;
    pos.push(...p.pos);
    nor.push(...p.nor);
    idx.push(...p.idx.map((i) => i + base));
  }
  return { pos, nor, idx };
}

/** Massing volume: ground slab, main mass, per-floor bands and a roof cap. */
function massing({ footprint, height, floors, ratio }) {
  const w = Math.sqrt(footprint * ratio);
  const d = footprint / w;
  const parts = [box(0, -0.15, 0, w * 1.18, 0.15, d * 1.18), box(0, 0, 0, w, height, d)];
  const n = Math.max(1, Math.min(floors, 8));
  for (let i = 1; i < n; i++) {
    const y = (height / n) * i;
    parts.push(box(0, y - 0.06, 0, w + 0.28, 0.12, d + 0.28));
  }
  parts.push(box(0, height, 0, w * 0.96, 0.35, d * 0.96));
  return { geometry: merge(parts), width: w, depth: d };
}

/* -------------------------------- glTF -------------------------------- */

function buildGlb(geometry, name) {
  const positions = new Float32Array(geometry.pos);
  const normals = new Float32Array(geometry.nor);
  const indices = new Uint32Array(geometry.idx);
  const pad4 = (n) => (4 - (n % 4)) % 4;

  const chunks = [positions, normals, indices];
  let offset = 0;
  const views = [];
  const parts = [];
  for (const c of chunks) {
    const bytes = Buffer.from(c.buffer, c.byteOffset, c.byteLength);
    views.push({ byteOffset: offset, byteLength: bytes.length });
    parts.push(bytes);
    const pad = pad4(bytes.length);
    if (pad) parts.push(Buffer.alloc(pad));
    offset += bytes.length + pad;
  }
  const bin = Buffer.concat(parts);

  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let a = 0; a < 3; a++) {
      min[a] = Math.min(min[a], positions[i + a]);
      max[a] = Math.max(max[a], positions[i + a]);
    }
  }

  const gltf = {
    asset: { version: "2.0", generator: "HALISIA.AI massing generator" },
    scene: 0,
    scenes: [{ nodes: [0], name }],
    nodes: [{ mesh: 0, name }],
    meshes: [
      { name, primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0 }] },
    ],
    materials: [
      {
        name: "Massing",
        pbrMetallicRoughness: {
          baseColorFactor: [0.886, 0.867, 0.82, 1],
          metallicFactor: 0.05,
          roughnessFactor: 0.72,
        },
        doubleSided: false,
      },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: positions.length / 3,
        type: "VEC3",
        min,
        max,
      },
      { bufferView: 1, componentType: 5126, count: normals.length / 3, type: "VEC3" },
      { bufferView: 2, componentType: 5125, count: indices.length, type: "SCALAR" },
    ],
    bufferViews: [
      {
        buffer: 0,
        byteOffset: views[0].byteOffset,
        byteLength: views[0].byteLength,
        target: 34962,
      },
      {
        buffer: 0,
        byteOffset: views[1].byteOffset,
        byteLength: views[1].byteLength,
        target: 34962,
      },
      {
        buffer: 0,
        byteOffset: views[2].byteOffset,
        byteLength: views[2].byteLength,
        target: 34963,
      },
    ],
    buffers: [{ byteLength: bin.length }],
  };

  let json = Buffer.from(JSON.stringify(gltf), "utf8");
  if (json.length % 4) json = Buffer.concat([json, Buffer.alloc(4 - (json.length % 4), 0x20)]);

  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0); // "glTF"
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + json.length + 8 + bin.length, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(json.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4); // JSON
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(bin.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4); // BIN
  return Buffer.concat([header, jsonHeader, json, binHeader, bin]);
}

/* -------------------------------- USDZ -------------------------------- */

function buildUsda(geometry, name) {
  const counts = [];
  for (let i = 0; i < geometry.idx.length; i += 3) counts.push(3);
  const pts = [];
  for (let i = 0; i < geometry.pos.length; i += 3) {
    pts.push(`(${geometry.pos[i]}, ${geometry.pos[i + 1]}, ${geometry.pos[i + 2]})`);
  }
  const nrm = [];
  for (const i of geometry.idx) {
    nrm.push(`(${geometry.nor[i * 3]}, ${geometry.nor[i * 3 + 1]}, ${geometry.nor[i * 3 + 2]})`);
  }
  return `#usda 1.0
(
    defaultPrim = "Massing"
    metersPerUnit = 1
    upAxis = "Y"
)

def Xform "Massing" (
    kind = "component"
)
{
    def Mesh "Volume"
    {
        uniform bool doubleSided = 0
        int[] faceVertexCounts = [${counts.join(", ")}]
        int[] faceVertexIndices = [${geometry.idx.join(", ")}]
        point3f[] points = [${pts.join(", ")}]
        normal3f[] primvars:normals = [${nrm.join(", ")}] (
            interpolation = "faceVarying"
        )
        int[] primvars:normals:indices = [${geometry.idx.map((_, i) => i).join(", ")}]
        uniform token subdivisionScheme = "none"
        rel material:binding = </Massing/MassingMaterial>
        custom string halisia:model = "${name} — indicative massing volume"
    }

    def Material "MassingMaterial"
    {
        token outputs:surface.connect = </Massing/MassingMaterial/Surface.outputs:surface>

        def Shader "Surface"
        {
            uniform token info:id = "UsdPreviewSurface"
            color3f inputs:diffuseColor = (0.886, 0.867, 0.82)
            float inputs:metallic = 0.05
            float inputs:roughness = 0.72
            token outputs:surface
        }
    }
}
`;
}

/** Minimal USDZ writer: uncompressed zip, every file body 64-byte aligned. */
function buildUsdz(files) {
  const out = [];
  const central = [];
  let offset = 0;
  for (const [name, data] of files) {
    const nameBuf = Buffer.from(name, "utf8");
    const headerLen = 30 + nameBuf.length;
    let extraLen = (64 - ((offset + headerLen) % 64)) % 64;
    if (extraLen > 0 && extraLen < 4) extraLen += 64;
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8); // stored
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(extraLen, 28);
    const extra = Buffer.alloc(extraLen);
    if (extraLen >= 4) {
      extra.writeUInt16LE(0x1986, 0); // padding extra-field id
      extra.writeUInt16LE(extraLen - 4, 2);
    }
    out.push(local, nameBuf, extra, data);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(data.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt32LE(offset, 42);
    central.push(cd, nameBuf);

    offset += headerLen + extraLen + data.length;
  }
  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([Buffer.concat(out), centralBuf, end]);
}

let CRC_TABLE = null;
function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

/* -------------------------------- main -------------------------------- */

const outDir = process.argv[2] ?? "/tmp/massing";
mkdirSync(outDir, { recursive: true });
void deflateSync; // stored-only zip; kept for clarity that no compression is used

for (const proto of PROTOTYPES) {
  const { geometry } = massing(proto);
  writeFileSync(join(outDir, `${proto.slug}.glb`), buildGlb(geometry, proto.slug));
  const usda = Buffer.from(buildUsda(geometry, proto.slug), "utf8");
  writeFileSync(join(outDir, `${proto.slug}.usdz`), buildUsdz([[`${proto.slug}.usda`, usda]]));
  console.log(`built ${proto.slug}`);
}
