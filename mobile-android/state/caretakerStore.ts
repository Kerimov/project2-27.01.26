import { create } from 'zustand';

/** Выбранный пациент при работе куратора (null = свои данные). */
type CaretakerState = {
  selectedPatientId: string | null;
  selectedPatientName: string | null;
  setPatient: (id: string | null, name?: string | null) => void;
};

export const useCaretakerStore = create<CaretakerState>((set) => ({
  selectedPatientId: null,
  selectedPatientName: null,
  setPatient: (id, name = null) =>
    set({ selectedPatientId: id, selectedPatientName: name }),
}));
