# Edit `src/routes/index.tsx`

**11 changes.** Open the file on GitHub, click the pencil
icon, then work through these in order with Ctrl+F (Cmd+F).

Each FIND block appears **exactly once** in the file. That was verified against
commit `6a4e62e8`. If a FIND block isn't found, stop and say so — do not
improvise, it means the file moved.

---

## 1. 2.1 remove hero search bar

**FIND:**

```tsx
            <div className="mx-auto mt-6 w-full max-w-xl">
              <SearchBar
                size="lg"
                placeholder="Search a county, town, parcel, LR number, ward, or coordinates…"
                onSearch={(q) => {
                  recordSearchConversion();
                  navigate({ to: "/explore", search: { q } });
                }}
              />
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
```

**REPLACE WITH:**

```tsx
            <div className="mx-auto mt-6 w-full max-w-xl">
              {/* The hero search bar handed off to /explore, which repeated the
                  map below. One search, attached to the map that answers it. */}
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
```

---

## 2. 2.2 dashboard link -> jump to map

**FIND:**

```tsx
                <Link
                  to="/explore"
                  className="inline-flex items-center gap-1.5 rounded-full glass border border-foreground/15 px-4 py-2 text-xs font-medium text-foreground hover:bg-foreground/5 transition"
                >
                  View Intelligence Dashboard
                </Link>
```

**REPLACE WITH:**

```tsx
                <a
                  href="#hero-map"
                  className="inline-flex items-center gap-1.5 rounded-full glass border border-foreground/15 px-4 py-2 text-xs font-medium text-foreground hover:bg-foreground/5 transition"
                >
                  Pick a point on the map
                </a>
```

---

## 3. 2.3 delete Popular chip row

**DELETE these lines entirely:**

```tsx
              <div className="mt-3 hidden sm:flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
                <span className="mr-1">Popular:</span>
                {["Kilimani", "Kiambu Road", "Nyali", "Naivasha", "Ruiru"].map((t) => (
                  <button
                    key={t}
                    onClick={() => navigate({ to: "/explore", search: { q: t } })}
                    className="glass rounded-full px-3 py-1 hover:text-foreground transition"
                  >
                    {t}
                  </button>
                ))}
              </div>
```

---

## 4. 2.4 Launch CTA -> jump to map

**FIND:**

```tsx
              <Link
                to="/explore"
                data-testid="launch-cta"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-medium px-6 py-3 shadow-[0_10px_40px_-10px_rgba(20,123,53,0.55)]"
              >
                Launch HALISIA <ArrowRight className="h-4 w-4" />
              </Link>
```

**REPLACE WITH:**

```tsx
              <a
                href="#hero-map"
                data-testid="launch-cta"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-medium px-6 py-3 shadow-[0_10px_40px_-10px_rgba(20,123,53,0.55)]"
              >
                Start with a point <ArrowRight className="h-4 w-4" />
              </a>
```

---

## 5. 2.5 delete floating Launch app button

**DELETE these lines entirely:**

```tsx
      <Link
        to="/explore"
        preload="intent"
        className="fixed z-50 inline-flex min-h-9 items-center gap-1.5 rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background left-3 sm:left-5 bottom-[max(0.75rem,env(safe-area-inset-bottom))] sm:bottom-5"
        aria-label="Launch HALISIA intelligence workspace"
        title="Launch HALISIA app"
      >
        <span className="hidden xs:inline sm:inline">Launch app</span>
        <span className="sm:hidden">Launch</span>
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
```

---

## 6. 2.6 delete footer Explore link

**DELETE these lines entirely:**

```tsx
              <Link to="/explore" className="hover:text-white transition">
                Explore
              </Link>
```

---

## 7. 2.7a drop useNavigate import

**FIND:**

```tsx
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
```

**REPLACE WITH:**

```tsx
import { createFileRoute, Link } from "@tanstack/react-router";
```

---

## 8. 2.7b drop SearchBar import

**DELETE these lines entirely:**

```tsx
import { SearchBar } from "@/components/halisia/search-bar";
```

---

## 9. 2.7c drop analytics import

**DELETE these lines entirely:**

```tsx
import { recordSearchConversion } from "@/lib/analytics";
```

---

## 10. 2.7d Landing drops navigate

**FIND:**

```tsx
function Landing() {
  const navigate = useNavigate();
  return <LandingBody navigate={navigate} />;
}
```

**REPLACE WITH:**

```tsx
function Landing() {
  return <LandingBody />;
}
```

---

## 11. 2.7e LandingBody drops navigate prop

**FIND:**

```tsx
function LandingBody({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
```

**REPLACE WITH:**

```tsx
function LandingBody() {
```
