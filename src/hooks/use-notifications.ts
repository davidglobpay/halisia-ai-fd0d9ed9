import { useCallback, useEffect, useState } from "react";

export type NotifPermission = "default" | "granted" | "denied" | "unsupported";

export function useNotifications() {
  const [permission, setPermission] = useState<NotifPermission>("default");

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission as NotifPermission);
  }, []);

  const request = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
    if (Notification.permission === "granted") {
      setPermission("granted");
      return "granted";
    }
    const r = await Notification.requestPermission();
    setPermission(r as NotifPermission);
    return r;
  }, []);

  const notify = useCallback(
    (title: string, opts?: NotificationOptions) => {
      if (permission !== "granted") return null;
      try {
        return new Notification(title, opts);
      } catch {
        return null;
      }
    },
    [permission],
  );

  return { permission, request, notify };
}
