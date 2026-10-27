/**
 * Solar position after the NOAA Solar Calculator spreadsheet algorithm.
 * Pure; no refraction correction (≤0.6° near the horizon, negligible above).
 * Azimuth: degrees clockwise from true north. Elevation: degrees above horizon.
 */
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export function solarPosition(
  date: Date,
  lat: number,
  lng: number,
): { azimuthDeg: number; elevationDeg: number } {
  const jd = date.getTime() / 86_400_000 + 2440587.5;
  const t = (jd - 2451545) / 36525;

  const l0 = (((280.46646 + t * (36000.76983 + t * 0.0003032)) % 360) + 360) % 360;
  const m = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const c =
    Math.sin(rad(m)) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(rad(2 * m)) * (0.019993 - 0.000101 * t) +
    Math.sin(rad(3 * m)) * 0.000289;
  const trueLong = l0 + c;
  const omega = 125.04 - 1934.136 * t;
  const appLong = trueLong - 0.00569 - 0.00478 * Math.sin(rad(omega));
  const meanObliq = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const obliq = meanObliq + 0.00256 * Math.cos(rad(omega));
  const decl = deg(Math.asin(Math.sin(rad(obliq)) * Math.sin(rad(appLong))));

  const y = Math.tan(rad(obliq / 2)) ** 2;
  const eqTime =
    4 *
    deg(
      y * Math.sin(2 * rad(l0)) -
        2 * e * Math.sin(rad(m)) +
        4 * e * y * Math.sin(rad(m)) * Math.cos(2 * rad(l0)) -
        0.5 * y * y * Math.sin(4 * rad(l0)) -
        1.25 * e * e * Math.sin(2 * rad(m)),
    );

  const utcMin =
    date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  const trueSolarMin = (((utcMin + eqTime + 4 * lng) % 1440) + 1440) % 1440;
  let hourAngle = trueSolarMin / 4 - 180;
  if (hourAngle < -180) hourAngle += 360;

  const cosZen =
    Math.sin(rad(lat)) * Math.sin(rad(decl)) +
    Math.cos(rad(lat)) * Math.cos(rad(decl)) * Math.cos(rad(hourAngle));
  const zenith = deg(Math.acos(Math.min(1, Math.max(-1, cosZen))));

  const denom = Math.cos(rad(lat)) * Math.sin(rad(zenith));
  let azimuth: number;
  if (Math.abs(denom) < 1e-9) {
    azimuth = lat > decl ? 180 : 0;
  } else {
    const a = (Math.sin(rad(lat)) * Math.cos(rad(zenith)) - Math.sin(rad(decl))) / denom;
    const az = deg(Math.acos(Math.min(1, Math.max(-1, a))));
    azimuth = hourAngle > 0 ? (az + 180) % 360 : (540 - az) % 360;
  }
  return { azimuthDeg: azimuth, elevationDeg: 90 - zenith };
}

/** Unit vector toward the sun in scene axes (+X east, +Y up, −Z north). */
export function sunDirection(azimuthDeg: number, elevationDeg: number): [number, number, number] {
  const az = rad(azimuthDeg);
  const el = rad(elevationDeg);
  return [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)];
}

/** EAT (UTC+3) wall-clock date + decimal hour → instant. */
export function eatInstant(isoDate: string, hour: number): Date {
  const [y, mo, d] = isoDate.split("-").map(Number);
  const h = Math.floor(hour);
  const min = Math.round((hour - h) * 60);
  return new Date(Date.UTC(y, (mo ?? 1) - 1, d ?? 1, h - 3, min));
}
