import { createContext, useContext } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { AppState, Page, CareerId, Activity } from "./data";

export type Store = {
  state: AppState;
  setState: Dispatch<SetStateAction<AppState>>;
  go: (page: Page, career?: CareerId) => void;
  careerId: CareerId;
  setCareerId: (id: CareerId) => void;
  toast: (message: string) => void;
  save: (id: CareerId) => void;
  record: (activity: Omit<Activity, "id" | "date">) => void;
  search: string;
  setSearch: (value: string) => void;
};
export const StoreContext = createContext<Store | null>(null);
export function useApp() {
  const context = useContext(StoreContext);
  if (!context) throw new Error("Store is unavailable");
  return context;
}
