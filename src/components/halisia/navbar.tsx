import { Link } from "@tanstack/react-router";
import halisiaLogo from "@/assets/halisia-logo.png.asset.json";

export function Navbar() {
  return (
    <header className="fixed top-4 left-1/2 z-50 w-[min(1200px,calc(100%-2rem))] -translate-x-1/2 glass rounded-full px-3 py-2 flex items-center justify-between">
      <Link to="/" className="flex items-center gap-2 pl-3">
        <img
          src={halisiaLogo.url}
          alt="HALISIA.AI"
          className="h-8 w-8 rounded-full object-cover shadow-[0_0_20px_oklch(0.68_0.19_249/0.5)]"
        />
        <span className="font-display font-semibold tracking-tight text-[15px]">
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
      <Link
        to="/explore"
        className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground text-sm font-medium px-4 py-2 shadow-[0_10px_30px_-10px_oklch(0.68_0.19_249/0.9)] hover:brightness-110 transition"
      >
        Launch app
      </Link>
    </header>
  );
}
