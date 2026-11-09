/**
 * A scripted camera tour of the house on its plot, cut like a short property
 * film: an aerial establishing shot, a slow low sweep round the house, a walk
 * up to the front door, a look round the living room, and a crane up and away.
 *
 * Pure numbers (no three.js), so the camera path is unit tested on its own.
 */

export type Vec3 = { x: number; y: number; z: number };
export type TourPose = { pos: Vec3; look: Vec3; fov: number };

export type TourSite = {
  /** Footprint, metres (x east, z south). */
  lengthM: number;
  widthM: number;
  heightM: number;
  /** Height of the finished floor in the scene. */
  floorY: number;
  /** Centre of the front door along the south wall (x), when known. */
  doorX: number | null;
  /** Ground height in the scene at a point. */
  groundAt: (x: number, z: number) => number;
};

type Shot = {
  seconds: number;
  /** Pose at progress u (0..1, already eased). */
  at: (u: number) => TourPose;
};

const EYE = 1.65;
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const lerp3 = (a: Vec3, b: Vec3, u: number): Vec3 => ({
  x: lerp(a.x, b.x, u),
  y: lerp(a.y, b.y, u),
  z: lerp(a.z, b.z, u),
});
/** Smooth start and stop, like a camera on a dolly. */
export const ease = (u: number) => {
  const t = Math.min(1, Math.max(0, u));
  return t * t * (3 - 2 * t);
};

export function tourShots(site: TourSite): Shot[] {
  const L = site.lengthM;
  const W = site.widthM;
  const fy = site.floorY;
  const size = Math.max(L, W, 8);
  const d = size * 1.6 + 6;
  const centre: Vec3 = { x: 0, y: fy + Math.min(2, site.heightM / 2), z: 0 };
  const g = site.groundAt;
  const doorX = site.doorX ?? 0;
  const front = W / 2;
  const masonryInside = site.doorX != null;

  const shots: Shot[] = [
    // 1. Aerial establishing shot, drifting in over the neighbourhood.
    {
      seconds: 6,
      at: (u) => ({
        pos: lerp3(
          { x: d * 1.5, y: fy + d * 1.05, z: d * 1.25 },
          { x: d * 0.85, y: fy + d * 0.5, z: d * 0.95 },
          u,
        ),
        look: centre,
        fov: lerp(46, 40, u),
      }),
    },
    // 2. Low sweep round the house, just above head height.
    {
      seconds: 9,
      at: (u) => {
        const a = lerp(0.95, -1.15, u); // radians from the south-east round past the south
        const r = d * 0.62;
        const x = Math.sin(a) * r;
        const z = Math.cos(a) * r;
        return {
          pos: { x, y: Math.max(g(x, z) + 2.2, fy + 0.6), z },
          look: { x: centre.x, y: fy + 1.4, z: centre.z },
          fov: 50,
        };
      },
    },
    // 3. Walk up to the front door.
    {
      seconds: 6,
      at: (u) => {
        const z = lerp(front + Math.max(7, size * 0.55), front + 1.6, u);
        const x = lerp(doorX - 2.2, doorX, u);
        return {
          pos: { x, y: Math.max(g(x, z), fy - 0.2) + EYE, z },
          look: { x: doorX, y: fy + 1.5, z: 0 },
          fov: 55,
        };
      },
    },
  ];
  if (masonryInside)
    // 4. Inside: stand just past the door and turn slowly across the living room.
    shots.push({
      seconds: 7,
      at: (u) => {
        const pos = { x: doorX, y: fy + 0.12 + EYE, z: front - 1.1 };
        const a = lerp(-0.9, 0.9, u) - Math.PI; // facing north, panning west to east
        return {
          pos,
          look: { x: pos.x + Math.sin(a) * 4, y: fy + 1.25, z: pos.z + Math.cos(a) * 4 },
          fov: 70,
        };
      },
    });
  // 5. Crane up and away from the front corner.
  shots.push({
    seconds: 7,
    at: (u) => {
      const x = lerp(-L * 0.55 - 3, -d * 0.7, u);
      const z = lerp(front + 4, d * 0.9, u);
      return {
        pos: { x, y: lerp(Math.max(g(x, z), fy - 0.2) + EYE, fy + d * 0.75, u), z },
        look: centre,
        fov: lerp(55, 42, u),
      };
    },
  });
  return shots;
}

export function tourLength(site: TourSite): number {
  return tourShots(site).reduce((s, q) => s + q.seconds, 0);
}

/** Camera pose `t` seconds into the tour, or null once it has finished. */
export function tourPose(site: TourSite, t: number): (TourPose & { shot: number }) | null {
  if (t < 0) return null;
  let start = 0;
  const shots = tourShots(site);
  for (let i = 0; i < shots.length; i++) {
    const q = shots[i];
    if (t < start + q.seconds) return { ...q.at(ease((t - start) / q.seconds)), shot: i };
    start += q.seconds;
  }
  return null;
}
