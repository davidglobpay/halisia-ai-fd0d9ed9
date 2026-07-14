import { Link } from "@tanstack/react-router";
import halisiaLogo from "@/assets/halisia-logo.png.asset.json";

export function Navbar() {
  return (
    <header className="fixed top-0 inset-x-0 z-50 w-full glass-strong border-b border-white/10 px-6 py-3 flex items-center justify-between">
      <Link to="/" className="flex items-center gap-2.5">
        <img
          src={halisiaLogo.url}
          alt="HALISIA.AI"
          className="h-9 w-9 rounded-full object-cover shadow-[0_0_20px_oklch(0.68_0.19_249/0.5)]"
        />
        <span className="font-display font-semibold tracking-tight text-[16px]">
          HALISIA<span className="text-accent">·</span>AI
        </span>
      </Link>
      <nav className="hidden md:flex items-center gap-1 text-sm text-muted-foreground">
        <Link
          to="/explore"
          className="px-3 py-1.5 rounded-full hover:text-foreground hover:bg-white/5 transition"
        >
          Explore
        </Link>
        <a
          href="#intelligence"
          className="px-3 py-1.5 rounded-full hover:text-foreground hover:bg-white/5 transition"
        >
          Intelligence
        </a>
        <a
          href="#trust"
          className="px-3 py-1.5 rounded-full hover:text-foreground hover:bg-white/5 transition"
        >
          Trust
        </a>
        <a
          href="#pricing"
          className="px-3 py-1.5 rounded-full hover:text-foreground hover:bg-white/5 transition"
        >
          Reports
        </a>
      </nav>
      <div className="flex items-center gap-3">
        <span className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground hidden lg:block">
          Land Intelligence · Kenya
        </span>
      </div>
    </header>
  );
}
