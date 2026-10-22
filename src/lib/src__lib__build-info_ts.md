# Edit `src/lib/build-info.ts`

**2 changes.** Do this one **LAST**, after every other file is committed.

This is the marker that proves which revision the live site is serving. Bumping
it before the other work lands would make it lie — which the file's own comment
says is worse than having no marker at all.

---

## 1. Bump the build identifier

**FIND:**

```ts
export const BUILD_ID = "2026-10-22.1";
```

**REPLACE WITH:**

```ts
export const BUILD_ID = "2026-10-22.2";
```

---

## 2. Say what this build changed

**FIND:**

```ts
export const BUILD_NOTE =
  "Evidence conclusions, county news and land-cover imagery in the Passport";
```

**REPLACE WITH:**

```ts
export const BUILD_NOTE =
  "Earth Intelligence site geometry and map sheet; landing declutter; Pulse publisher veto";
```

---

After this commit, confirm what the CDN actually serves:

```
curl -s https://halisia-ai.lovable.app/ | grep -o 'halisia-build[^>]*'
```

Expect `2026-10-22.2`. If it still says `.1`, the deploy has not taken and
nothing above is live yet.
