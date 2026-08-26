import base from "./playwright.config";
const cfg: any = { ...base };
cfg.projects = (base as any).projects?.map((p: any) => ({
  ...p,
  use: { ...p.use, launchOptions: { ...(p.use?.launchOptions ?? {}), executablePath: "/nix/store/2zqa6kavc8znbgrac1l3pix9lwr3w5nj-playwright-chromium/chrome-linux/chrome" } },
}));
export default cfg;
