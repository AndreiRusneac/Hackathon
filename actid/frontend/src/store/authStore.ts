import { create } from "zustand";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  token: string | null;
  sessionToken: string | null;
  demoOtp: string | null;
  isAuthenticated: boolean;
  setUser: (user: User, token: string) => void;
  setSessionToken: (session: string, demoOtp: string) => void;
  logout: () => void;
  hydrate: () => void;
}

const _loadFromStorage = (): Pick<AuthState, "user" | "token" | "isAuthenticated"> => {
  try {
    const token = localStorage.getItem("actid_token");
    const userStr = localStorage.getItem("actid_user");
    if (token && userStr) {
      return { token, user: JSON.parse(userStr) as User, isAuthenticated: true };
    }
  } catch {
    localStorage.removeItem("actid_token");
    localStorage.removeItem("actid_user");
  }
  return { token: null, user: null, isAuthenticated: false };
};

export const useAuthStore = create<AuthState>((set) => ({
  ..._loadFromStorage(),
  sessionToken: null,
  demoOtp: null,

  setUser: (user, token) => {
    localStorage.setItem("actid_token", token);
    localStorage.setItem("actid_user", JSON.stringify(user));
    set({ user, token, isAuthenticated: true, sessionToken: null, demoOtp: null });
  },

  setSessionToken: (session, demoOtp) => {
    set({ sessionToken: session, demoOtp });
  },

  logout: () => {
    localStorage.removeItem("actid_token");
    localStorage.removeItem("actid_user");
    set({ user: null, token: null, isAuthenticated: false, sessionToken: null, demoOtp: null });
  },

  hydrate: () => {
    const token = localStorage.getItem("actid_token");
    const userStr = localStorage.getItem("actid_user");
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr) as User;
        set({ user, token, isAuthenticated: true });
      } catch {
        localStorage.removeItem("actid_token");
        localStorage.removeItem("actid_user");
      }
    }
  },
}));
