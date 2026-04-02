import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { NoteItem, NoteColor } from '../types';
import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'zeeco-notes';
const PROJECT_ORDER_KEY = 'zeeco-notes-project-order';

interface NoteContextType {
  notes: NoteItem[];
  addNote: (note: { projectId: string; title: string; content: string; color?: NoteColor }) => void;
  updateNote: (id: string, updates: Partial<NoteItem>) => void;
  deleteNote: (id: string) => void;
  toggleHideNote: (id: string) => void;
  togglePinNote: (id: string) => void;
  reorderNotes: (projectId: string, reorderedIds: string[]) => void;
  projectOrder: string[];
  reorderProjectCards: (orderedIds: string[]) => void;
}

const NoteContext = createContext<NoteContextType | null>(null);

export function NoteProvider({ children }: { children: ReactNode }) {
  const [notes, setNotes] = useState<NoteItem[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [projectOrder, setProjectOrder] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(PROJECT_ORDER_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    localStorage.setItem(PROJECT_ORDER_KEY, JSON.stringify(projectOrder));
  }, [projectOrder]);

  const addNote = useCallback((note: { projectId: string; title: string; content: string; color?: NoteColor }) => {
    setNotes(prev => {
      const projectNotes = prev.filter(n => n.projectId === note.projectId);
      const maxOrder = projectNotes.length > 0 ? Math.max(...projectNotes.map(n => n.sortOrder)) : -1;
      const now = new Date().toISOString();
      return [...prev, {
        id: uuidv4(),
        projectId: note.projectId,
        title: note.title,
        content: note.content,
        color: note.color || 'default',
        hidden: false,
        pinned: false,
        createdAt: now,
        updatedAt: now,
        sortOrder: maxOrder + 1,
      }];
    });
  }, []);

  const updateNote = useCallback((id: string, updates: Partial<NoteItem>) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n));
  }, []);

  const deleteNote = useCallback((id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
  }, []);

  const toggleHideNote = useCallback((id: string) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, hidden: !n.hidden } : n));
  }, []);

  const togglePinNote = useCallback((id: string) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, pinned: !n.pinned } : n));
  }, []);

  const reorderNotes = useCallback((_projectId: string, reorderedIds: string[]) => {
    setNotes(prev => {
      const updated = [...prev];
      reorderedIds.forEach((id, index) => {
        const idx = updated.findIndex(n => n.id === id);
        if (idx !== -1) updated[idx] = { ...updated[idx], sortOrder: index };
      });
      return updated;
    });
  }, []);

  const reorderProjectCards = useCallback((orderedIds: string[]) => {
    setProjectOrder(orderedIds);
  }, []);

  return (
    <NoteContext.Provider value={{
      notes, addNote, updateNote, deleteNote, toggleHideNote, togglePinNote,
      reorderNotes, projectOrder, reorderProjectCards,
    }}>
      {children}
    </NoteContext.Provider>
  );
}

export function useNotes() {
  const ctx = useContext(NoteContext);
  if (!ctx) throw new Error('useNotes must be used within NoteProvider');
  return ctx;
}
