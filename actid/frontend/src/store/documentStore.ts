import { create } from "zustand";
import type { Document, DelegatedDocument } from "@/types";

interface DocumentState {
  documents: Document[];
  delegatedDocuments: DelegatedDocument[];
  loading: boolean;
  error: string | null;
  setDocuments: (docs: Document[]) => void;
  setDelegatedDocuments: (docs: DelegatedDocument[]) => void;
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
  addDocument: (doc: Document) => void;
  removeDocument: (id: string) => void;
  reset: () => void;
}

export const useDocumentStore = create<DocumentState>((set) => ({
  documents: [],
  delegatedDocuments: [],
  loading: false,
  error: null,

  setDocuments: (docs) => set({ documents: docs }),
  setDelegatedDocuments: (docs) => set({ delegatedDocuments: docs }),
  setLoading: (v) => set({ loading: v }),
  setError: (e) => set({ error: e }),
  addDocument: (doc) => set((s) => ({ documents: [doc, ...s.documents] })),
  removeDocument: (id) =>
    set((s) => ({ documents: s.documents.filter((d) => d.id !== id) })),
  reset: () =>
    set({ documents: [], delegatedDocuments: [], loading: false, error: null }),
}));
