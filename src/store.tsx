import { createContext, useContext } from "react";
import type {
  AppState,
  Page,
  CareerId,
  Profile,
  Career,
  SourceReference,
} from "./data";

export type RouteOptions = { activityId?: string; sessionId?: string };
export type Store = {
  state: AppState;
  go: (page: Page, career?: CareerId, tab?: string, options?: RouteOptions) => void;
  activityId?: string;
  sessionId?: string;
  careerId: CareerId;
  setCareerId: (id: CareerId) => void;
  toast: (message: string) => void;
  save: (id: CareerId) => Promise<void>;
  refresh: () => Promise<void>;
  retry: () => void;
  user: Profile | null;
  loading: boolean;
  error: string;
  requireAuth: () => boolean;
  completeAuth: () => Promise<void>;
  clearUser: () => void;
  logout: () => Promise<void>;
  loggingOut: boolean;
  catalog: (Career & { sources?: SourceReference[] })[];
  onboardingInterests: string[];
  setOnboardingInterests: (interests: string[]) => void;
  registerNavigationGuard: (
    guard: (reason?: "navigate" | "logout") => Promise<boolean>,
  ) => () => void;
  search: string;
  setSearch: (value: string) => void;
};
export const StoreContext = createContext<Store | null>(null);
export function useApp() {
  const context = useContext(StoreContext);
  if (!context) throw new Error("Store is unavailable");
  return context;
}
