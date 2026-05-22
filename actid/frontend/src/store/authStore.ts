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

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  sessionToken: null,
  demoOtp: null,
  isAuthenticated: false,

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
