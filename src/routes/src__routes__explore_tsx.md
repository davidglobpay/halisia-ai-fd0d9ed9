# Edit `src/routes/explore.tsx`

**1 change.** Open the file on GitHub, click the pencil
icon, then work through these in order with Ctrl+F (Cmd+F).

Each FIND block appears **exactly once** in the file. That was verified against
commit `6a4e62e8`. If a FIND block isn't found, stop and say so — do not
improvise, it means the file moved.

---

## 1. 2.10 delete two dead buttons (no onClick)

**DELETE these lines entirely:**

```tsx
              <div className="pointer-events-auto self-end flex gap-2">
                <button className="glass rounded-full px-3 py-2 text-xs inline-flex items-center gap-1.5">
                  <Ruler className="h-3.5 w-3.5 text-accent" /> Measure
                </button>
                <button className="glass rounded-full px-3 py-2 text-xs inline-flex items-center gap-1.5">
                  <Bookmark className="h-3.5 w-3.5 text-accent" /> Save
                </button>
              </div>
```
