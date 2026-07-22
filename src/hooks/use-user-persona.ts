import { usePersistedState } from "@/hooks/use-persisted-state";
import type { Persona } from "@/lib/intelligence-engine";

/** Persisted user persona — drives persona-weighted LIOS across every view. */
export function useUserPersona() {
  return usePersistedState<Persona>("halisia:persona", "investor");
}