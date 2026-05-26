import { create } from 'zustand';

type AiChatLaunchState = {
  initialDocumentIds?: string[];
  autoOpen?: boolean;
  setLaunch: (payload: { initialDocumentIds?: string[]; autoOpen?: boolean }) => void;
  clearLaunch: () => void;
};

export const useAiChatLaunchStore = create<AiChatLaunchState>((set) => ({
  initialDocumentIds: undefined,
  autoOpen: false,
  setLaunch: (payload) => set(payload),
  clearLaunch: () => set({ initialDocumentIds: undefined, autoOpen: false }),
}));
