import { useSearchParams } from "react-router-dom";

export function useDashboardTab(defaultTab: string, allowed: string[]) {
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab") ?? defaultTab;
  const tab = allowed.includes(requested) ? requested : defaultTab;
  const setTab = (value: string) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set("tab", value);
        next.delete("view");
        return next;
      },
      { replace: true },
    );
  return [tab, setTab] as const;
}
