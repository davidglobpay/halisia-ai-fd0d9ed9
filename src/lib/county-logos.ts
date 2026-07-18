import c01 from "@/assets/county-logos/01-mombasa.png.asset.json";
import c02 from "@/assets/county-logos/02-kwale.png.asset.json";
import c03 from "@/assets/county-logos/03-kilifi.png.asset.json";
import c04 from "@/assets/county-logos/04-tana-river.png.asset.json";
import c05 from "@/assets/county-logos/05-lamu.png.asset.json";
import c06 from "@/assets/county-logos/06-taita-taveta.png.asset.json";
import c07 from "@/assets/county-logos/07-garissa.png.asset.json";
import c08 from "@/assets/county-logos/08-wajir.png.asset.json";
import c09 from "@/assets/county-logos/09-mandera.png.asset.json";
import c10 from "@/assets/county-logos/10-marsabit.png.asset.json";
import c11 from "@/assets/county-logos/11-isiolo.png.asset.json";
import c12 from "@/assets/county-logos/12-meru.png.asset.json";
import c13 from "@/assets/county-logos/13-tharaka-nithi.png.asset.json";
import c16 from "@/assets/county-logos/16-machakos.png.asset.json";
import c19 from "@/assets/county-logos/19-nyeri.png.asset.json";
import c20 from "@/assets/county-logos/20-kirinyaga.png.asset.json";
import c21 from "@/assets/county-logos/21-muranga.png.asset.json";
import c22 from "@/assets/county-logos/22-kiambu.png.asset.json";
import c23 from "@/assets/county-logos/23-turkana.png.asset.json";
import c24 from "@/assets/county-logos/24-west-pokot.png.asset.json";
import c25 from "@/assets/county-logos/25-samburu.png.asset.json";
import c26 from "@/assets/county-logos/26-trans-nzoia.png.asset.json";
import c27 from "@/assets/county-logos/27-uasin-gishu.png.asset.json";
import c28 from "@/assets/county-logos/28-elgeyo-marakwet.png.asset.json";
import c29 from "@/assets/county-logos/29-nandi.png.asset.json";
import c30 from "@/assets/county-logos/30-baringo.png.asset.json";
import c32 from "@/assets/county-logos/32-nakuru.png.asset.json";
import c35 from "@/assets/county-logos/35-kericho.png.asset.json";
import c36 from "@/assets/county-logos/36-bomet.png.asset.json";
import c38 from "@/assets/county-logos/38-vihiga.png.asset.json";
import c39 from "@/assets/county-logos/39-bungoma.png.asset.json";
import c40 from "@/assets/county-logos/40-busia.png.asset.json";

// Locally re-cropped emblems (override CDN asset URLs). These 13 counties
// had off-center or cropped logos in the original CDN assets; the PNGs at
// these paths were re-cropped from the official Council of Governors poster
// and are bundled via Vite so they always match the file on disk.
import local14 from "@/assets/county-logos/14-embu.png";
import local15 from "@/assets/county-logos/15-kitui.png";
import local17 from "@/assets/county-logos/17-makueni.png";
import local18 from "@/assets/county-logos/18-nyandarua.png";
import local31 from "@/assets/county-logos/31-laikipia.png";
import local33 from "@/assets/county-logos/33-narok.png";
import local34 from "@/assets/county-logos/34-kajiado.png";
import local37 from "@/assets/county-logos/37-kakamega.png";
import local41 from "@/assets/county-logos/41-siaya.png";
import local42 from "@/assets/county-logos/42-kisumu.png";
import local43 from "@/assets/county-logos/43-homa-bay.png";
import local44 from "@/assets/county-logos/44-migori.png";
import local45 from "@/assets/county-logos/45-kisii.png";
import local46 from "@/assets/county-logos/46-nyamira.png";
import local47 from "@/assets/county-logos/47-nairobi-city.png";

export const COUNTY_LOGOS: Record<number, string> = {
  1: c01.url,
  2: c02.url,
  3: c03.url,
  4: c04.url,
  5: c05.url,
  6: c06.url,
  7: c07.url,
  8: c08.url,
  9: c09.url,
  10: c10.url,
  11: c11.url,
  12: c12.url,
  13: c13.url,
  14: local14,
  15: local15,
  16: c16.url,
  17: local17,
  18: local18,
  19: c19.url,
  20: c20.url,
  21: c21.url,
  22: c22.url,
  23: c23.url,
  24: c24.url,
  25: c25.url,
  26: c26.url,
  27: c27.url,
  28: c28.url,
  29: c29.url,
  30: c30.url,
  31: local31,
  32: c32.url,
  33: local33,
  34: local34,
  35: c35.url,
  36: c36.url,
  37: local37,
  38: c38.url,
  39: c39.url,
  40: c40.url,
  41: local41,
  42: local42,
  43: local43,
  44: local44,
  45: local45,
  46: local46,
  47: local47,
};
