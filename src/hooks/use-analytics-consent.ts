import { useEffect, useState } from "react";
import {
  getAnalyticsConsent,
  onConsentChange,
  setAnalyticsConsent,
  type ConsentState,
} from "@/lib/analytics";

/** React hook that mirrors the analytics-consent state and lets components toggle it. */
export function useAnalyticsConsent(): [ConsentState, (granted: boolean) => void] {
  const [state, setState] = useState<ConsentState>("unset");
  useEffect(() => {
    setState(getAnalyticsConsent());
    return onConsentChange(setState);
  }, []);
  return [state, setAnalyticsConsent];
}
