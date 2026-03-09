import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { TodoItem, TodoCategory, TodoPriority } from '../types';
import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'zeeco-todos';

interface TodoContextType {
  todos: TodoItem[];
  addTodo: (todo: Omit<TodoItem, 'id' | 'completed' | 'completedAt' | 'createdAt' | 'sortOrder'>) => void;
  updateTodo: (id: string, updates: Partial<TodoItem>) => void;
  deleteTodo: (id: string) => void;
  toggleComplete: (id: string) => void;
  bulkComplete: (ids: string[]) => void;
  bulkDelete: (ids: string[]) => void;
  reorderTodos: (projectId: string, reorderedIds: string[]) => void;
}

const TodoContext = createContext<TodoContextType | null>(null);

export function TodoProvider({ children }: { children: ReactNode }) {
  const [todos, setTodos] = useState<TodoItem[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  }, [todos]);

  const addTodo = useCallback((todo: Omit<TodoItem, 'id' | 'completed' | 'completedAt' | 'createdAt' | 'sortOrder'>) => {
    setTodos(prev => {
      const projectTodos = prev.filter(t => t.projectId === todo.projectId && !t.completed);
      const maxOrder = projectTodos.length > 0 ? Math.max(...projectTodos.map(t => t.sortOrder)) : -1;
      return [...prev, {
        ...todo,
        id: uuidv4(),
        completed: false,
        completedAt: '',
        createdAt: new Date().toISOString(),
        sortOrder: maxOrder + 1,
      }];
    });
  }, []);

  const updateTodo = useCallback((id: string, updates: Partial<TodoItem>) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  const deleteTodo = useCallback((id: string) => {
    setTodos(prev => prev.filter(t => t.id !== id));
  }, []);

  const toggleComplete = useCallback((id: string) => {
    setTodos(prev => prev.map(t => {
      if (t.id !== id) return t;
      const nowComplete = !t.completed;
      return { ...t, completed: nowComplete, completedAt: nowComplete ? new Date().toISOString() : '' };
    }));
  }, []);

  const bulkComplete = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    setTodos(prev => prev.map(t => {
      if (!idSet.has(t.id) || t.completed) return t;
      return { ...t, completed: true, completedAt: new Date().toISOString() };
    }));
  }, []);

  const bulkDelete = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    setTodos(prev => prev.filter(t => !idSet.has(t.id)));
  }, []);

  const reorderTodos = useCallback((projectId: string, reorderedIds: string[]) => {
    setTodos(prev => {
      const updated = [...prev];
      reorderedIds.forEach((id, index) => {
        const idx = updated.findIndex(t => t.id === id);
        if (idx !== -1) updated[idx] = { ...updated[idx], sortOrder: index };
      });
      return updated;
    });
  }, []);

  return (
    <TodoContext.Provider value={{ todos, addTodo, updateTodo, deleteTodo, toggleComplete, bulkComplete, bulkDelete, reorderTodos }}>
      {children}
    </TodoContext.Provider>
  );
}

export function useTodos() {
  const ctx = useContext(TodoContext);
  if (!ctx) throw new Error('useTodos must be used within TodoProvider');
  return ctx;
}
