import { create } from "zustand";

interface ElderlyState {
  enabled: boolean;
  toggle: () => void;
}

function readStorage(): boolean {
  try {
    return localStorage.getItem("actid-elderly-mode") === "true";
  } catch {
    return false;
  }
}

if (readStorage()) {
  document.documentElement.classList.add("elderly");
}

export const useElderlyStore = create<ElderlyState>((set) => ({
  enabled: readStorage(),
  toggle: () =>
    set((s) => {
      const next = !s.enabled;
      try {
        localStorage.setItem("actid-elderly-mode", String(next));
      } catch {}
      document.documentElement.classList.toggle("elderly", next);
      return { enabled: next };
    }),
}));
