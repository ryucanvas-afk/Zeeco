import { useState, useRef, useMemo } from 'react';
import { useTodos } from '../context/TodoContext';
import { useProjects } from '../context/ProjectContext';
import type { TodoItem, TodoCategory, TodoDefaultCategory, TodoPriority, QuickPhrase } from '../types';

const CATEGORY_MAP: Record<TodoDefaultCategory, { label: string; color: string }> = {
  mail_write: { label: '메일 작성', color: '#3b82f6' },
  mail_reply: { label: '메일 회신', color: '#06b6d4' },
  drawing: { label: '도면', color: '#f59e0b' },
  eic_request: { label: '전계장팀 요청', color: '#8b5cf6' },
  confirmation: { label: '확인 사항', color: '#10b981' },
  purchase_order: { label: '발주', color: '#ef4444' },
  general_request: { label: '일반 요청', color: '#94a3b8' },
};

const CUSTOM_CATEGORY_COLORS = ['#e11d48', '#7c3aed', '#0891b2', '#059669', '#d97706', '#dc2626', '#4f46e5', '#0d9488', '#ca8a04', '#be185d'];

const PRIORITY_MAP: Record<TodoPriority, { label: string; color: string; order: number }> = {
  urgent: { label: '긴급', color: '#ef4444', order: 0 },
  high: { label: '높음', color: '#f59e0b', order: 1 },
  normal: { label: '보통', color: '#3b82f6', order: 2 },
  low: { label: '낮음', color: '#94a3b8', order: 3 },
};

const DEFAULT_CATEGORIES = Object.keys(CATEGORY_MAP) as TodoDefaultCategory[];
const ALL_PRIORITIES = Object.keys(PRIORITY_MAP) as TodoPriority[];

function isDefaultCategory(cat: string): cat is TodoDefaultCategory {
  return cat in CATEGORY_MAP;
}

function getCategoryInfo(cat: TodoCategory, customCategories: string[]): { label: string; color: string } {
  if (isDefaultCategory(cat)) return CATEGORY_MAP[cat];
  const idx = customCategories.indexOf(cat);
  const color = CUSTOM_CATEGORY_COLORS[idx >= 0 ? idx % CUSTOM_CATEGORY_COLORS.length : 0];
  return { label: cat, color };
}

const PHRASE_CATEGORIES = ['인사/마무리', '요청', '확인', '회신', '납기', '검수', '일반'];

type ViewTab = 'active' | 'completed';

export default function TodoList() {
  const { todos, addTodo, updateTodo, deleteTodo, toggleComplete, bulkComplete, bulkDelete, reorderTodos, phrases, addPhrase, updatePhrase, deletePhrase, customCategories, addCustomCategory, deleteCustomCategory, updateCustomCategory } = useTodos();
  const { projects } = useProjects();
  const visibleProjects = projects.filter(p => !p.hidden);

  const allCategories: TodoCategory[] = [...DEFAULT_CATEGORIES, ...customCategories];

  const [viewTab, setViewTab] = useState<ViewTab>('active');
  const [filterCategory, setFilterCategory] = useState<TodoCategory | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<TodoPriority | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hideCompleted, setHideCompleted] = useState(false);

  // Add form state
  const [showAddForm, setShowAddForm] = useState<string | null>(null); // projectId or null
  const [editingTodo, setEditingTodo] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    memo: '',
    category: 'general_request' as TodoCategory,
    priority: 'normal' as TodoPriority,
    dueDate: '',
    dueDateTBD: false,
    projectId: '',
  });

  // Phrases state
  const [showPhrases, setShowPhrases] = useState(true);
  const [phraseSearch, setPhraseSearch] = useState('');
  const [phraseFilterCat, setPhraseFilterCat] = useState<string>('all');
  const [editingPhrase, setEditingPhrase] = useState<string | null>(null);
  const [phraseForm, setPhraseForm] = useState({ title: '', content: '', category: '일반' });
  const [showPhraseForm, setShowPhraseForm] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Category combobox state
  const [categoryMode, setCategoryMode] = useState<'select' | 'custom'>('select');
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  // Category management state
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editCategoryInput, setEditCategoryInput] = useState('');

  const filteredPhrases = useMemo(() => {
    let result = phrases;
    if (phraseFilterCat !== 'all') {
      result = result.filter(p => p.category === phraseFilterCat);
    }
    if (phraseSearch.trim()) {
      const q = phraseSearch.toLowerCase();
      result = result.filter(p => p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q));
    }
    return result;
  }, [phrases, phraseFilterCat, phraseSearch]);

  const handlePhraseSubmit = () => {
    if (!phraseForm.content.trim()) return;
    const title = phraseForm.title.trim() || phraseForm.content.trim().slice(0, 30);
    if (editingPhrase) {
      updatePhrase(editingPhrase, { title, content: phraseForm.content, category: phraseForm.category });
    } else {
      addPhrase({ title, content: phraseForm.content, category: phraseForm.category });
    }
    setPhraseForm({ title: '', content: '', category: '일반' });
    setShowPhraseForm(false);
    setEditingPhrase(null);
  };

  const startEditPhrase = (p: QuickPhrase) => {
    setEditingPhrase(p.id);
    setPhraseForm({ title: '', content: p.content, category: p.category });
    setShowPhraseForm(true);
  };

  const handleCopyPhrase = async (p: QuickPhrase) => {
    try {
      await navigator.clipboard.writeText(p.content);
      setCopiedId(p.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = p.content;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedId(p.id);
      setTimeout(() => setCopiedId(null), 1500);
    }
  };

  // Drag state
  const [dragItem, setDragItem] = useState<string | null>(null);
  const [dragOverItem, setDragOverItem] = useState<string | null>(null);
  const dragProjectId = useRef<string | null>(null);

  // Filter todos
  const filteredTodos = useMemo(() => {
    let result = todos;

    if (viewTab === 'active') {
      result = result.filter(t => !t.completed);
    } else {
      result = result.filter(t => t.completed);
      if (hideCompleted) return [];
    }

    if (filterCategory !== 'all') {
      result = result.filter(t => t.category === filterCategory);
    }
    if (filterPriority !== 'all') {
      result = result.filter(t => t.priority === filterPriority);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t => t.title.toLowerCase().includes(q) || t.memo.toLowerCase().includes(q));
    }

    return result;
  }, [todos, viewTab, filterCategory, filterPriority, searchQuery, hideCompleted]);

  // Group by project
  const groupedByProject = useMemo(() => {
    const map = new Map<string, TodoItem[]>();
    for (const todo of filteredTodos) {
      const group = map.get(todo.projectId) || [];
      group.push(todo);
      map.set(todo.projectId, group);
    }
    for (const [key, items] of map) {
      if (viewTab === 'active') {
        items.sort((a, b) => a.sortOrder - b.sortOrder);
      } else {
        items.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
      }
      map.set(key, items);
    }
    return map;
  }, [filteredTodos, viewTab]);

  const resetForm = () => {
    setFormData({ title: '', memo: '', category: 'general_request', priority: 'normal', dueDate: '', dueDateTBD: false, projectId: '' });
    setShowAddForm(null);
    setEditingTodo(null);
  };

  const handleSubmit = (projectId: string) => {
    if (!formData.title.trim()) return;

    if (editingTodo) {
      updateTodo(editingTodo, {
        title: formData.title,
        memo: formData.memo,
        category: formData.category,
        priority: formData.priority,
        dueDate: formData.dueDateTBD ? '' : formData.dueDate,
        dueDateTBD: formData.dueDateTBD,
      });
    } else {
      addTodo({
        title: formData.title,
        memo: formData.memo,
        category: formData.category,
        priority: formData.priority,
        dueDate: formData.dueDateTBD ? '' : formData.dueDate,
        dueDateTBD: formData.dueDateTBD,
        projectId,
      });
    }
    resetForm();
  };

  const startEdit = (todo: TodoItem) => {
    setEditingTodo(todo.id);
    setShowAddForm(todo.projectId);
    setFormData({
      title: todo.title,
      memo: todo.memo,
      category: todo.category,
      priority: todo.priority,
      dueDate: todo.dueDate,
      dueDateTBD: todo.dueDateTBD,
      projectId: todo.projectId,
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllInProject = (projectId: string) => {
    const ids = filteredTodos.filter(t => t.projectId === projectId).map(t => t.id);
    setSelectedIds(prev => {
      const next = new Set(prev);
      const allSelected = ids.every(id => next.has(id));
      if (allSelected) {
        ids.forEach(id => next.delete(id));
      } else {
        ids.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const handleBulkComplete = () => {
    bulkComplete(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  const handleBulkDelete = () => {
    if (!confirm(`${selectedIds.size}개 항목을 삭제하시겠습니까?`)) return;
    bulkDelete(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  // Drag handlers
  const handleDragStart = (todoId: string, projectId: string) => {
    setDragItem(todoId);
    dragProjectId.current = projectId;
  };

  const handleDragOver = (e: React.DragEvent, todoId: string, projectId: string) => {
    e.preventDefault();
    if (dragProjectId.current !== projectId) return;
    setDragOverItem(todoId);
  };

  const handleDrop = (projectId: string) => {
    if (!dragItem || !dragOverItem || dragItem === dragOverItem || dragProjectId.current !== projectId) {
      setDragItem(null);
      setDragOverItem(null);
      return;
    }

    const projectTodos = groupedByProject.get(projectId) || [];
    const ids = projectTodos.map(t => t.id);
    const fromIdx = ids.indexOf(dragItem);
    const toIdx = ids.indexOf(dragOverItem);
    if (fromIdx === -1 || toIdx === -1) return;

    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, dragItem);
    reorderTodos(projectId, ids);

    setDragItem(null);
    setDragOverItem(null);
  };

  const getDueDateDisplay = (todo: TodoItem) => {
    if (todo.dueDateTBD) return <span className="todo-due-tbd">TBD</span>;
    if (!todo.dueDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(todo.dueDate);
    due.setHours(0, 0, 0, 0);
    const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    let className = 'todo-due-date';
    if (diff < 0) className += ' todo-due-overdue';
    else if (diff <= 2) className += ' todo-due-soon';

    const label = diff < 0 ? `D+${Math.abs(diff)}` : diff === 0 ? 'D-Day' : `D-${diff}`;
    return <span className={className}>{todo.dueDate} ({label})</span>;
  };

  const COMMON_PROJECT_ID = '__common__';

  const getProjectName = (projectId: string) => {
    if (projectId === COMMON_PROJECT_ID) return '공통 사항';
    if (!projectId) return '프로젝트 미지정';
    const p = projects.find(p => p.id === projectId);
    return p ? `${p.projectNo ? p.projectNo + ' - ' : ''}${p.name}` : '삭제된 프로젝트';
  };

  const getProjectColor = (projectId: string) => {
    if (projectId === COMMON_PROJECT_ID) return '#6366f1';
    const p = projects.find(p => p.id === projectId);
    return p?.color || '#475569';
  };

  // Which projects to show cards for
  const projectIdsToShow = useMemo(() => {
    const idsWithTodos = Array.from(groupedByProject.keys());
    const allIds = new Set([COMMON_PROJECT_ID, ...visibleProjects.map(p => p.id), ...idsWithTodos]);
    const sorted = Array.from(allIds).filter(id => id !== COMMON_PROJECT_ID).sort((a, b) => {
      const aHas = groupedByProject.has(a) ? 0 : 1;
      const bHas = groupedByProject.has(b) ? 0 : 1;
      if (aHas !== bHas) return aHas - bHas;
      return getProjectName(a).localeCompare(getProjectName(b));
    });
    return [COMMON_PROJECT_ID, ...sorted];
  }, [groupedByProject, visibleProjects]);

  const activeTodoCount = todos.filter(t => !t.completed).length;
  const completedTodoCount = todos.filter(t => t.completed).length;

  return (
    <div className="todo-page">
      <div className="page-header">
        <div>
          <h2>To-Do List</h2>
          <p className="page-desc">프로젝트별 할 일 관리</p>
        </div>
      </div>

      {/* ===== Quick Phrases - Top Full Width Section ===== */}
      <div className="phrases-top-section">
        <div className="phrases-top-header">
          <div className="phrases-top-title-row">
            <h3>자주 쓰는 문구</h3>
            <span className="phrases-top-count">{phrases.length}개</span>
          </div>
          <div className="phrases-top-actions">
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => setShowPhrases(!showPhrases)}
            >
              {showPhrases ? '접기' : '펼치기'}
            </button>
            {showPhrases && (
              <button
                className="btn btn-sm btn-primary"
                onClick={() => { setShowPhraseForm(true); setEditingPhrase(null); setPhraseForm({ title: '', content: '', category: '일반' }); }}
              >
                + 새 문구
              </button>
            )}
          </div>
        </div>

        {showPhrases && (
          <>
            {/* Phrase Add/Edit Form */}
            {showPhraseForm && (
              <div className="phrases-top-form">
                <div className="phrases-simple-form">
                  <input
                    type="text"
                    placeholder="문구를 입력하세요..."
                    value={phraseForm.content}
                    onChange={e => setPhraseForm(prev => ({ ...prev, content: e.target.value }))}
                    className="phrases-top-input phrases-simple-input"
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handlePhraseSubmit(); } }}
                  />
                  <select
                    value={phraseForm.category}
                    onChange={e => setPhraseForm(prev => ({ ...prev, category: e.target.value }))}
                    className="phrases-top-select"
                  >
                    {PHRASE_CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <button className="btn btn-sm btn-primary" onClick={handlePhraseSubmit}>
                    {editingPhrase ? '수정' : '저장'}
                  </button>
                  <button className="btn btn-sm btn-ghost" onClick={() => { setShowPhraseForm(false); setEditingPhrase(null); }}>취소</button>
                </div>
              </div>
            )}

            {/* Filters */}
            {phrases.length > 0 && (
              <div className="phrases-top-filters">
                <div className="phrases-top-search">
                  <input
                    type="text"
                    placeholder="문구 검색..."
                    value={phraseSearch}
                    onChange={e => setPhraseSearch(e.target.value)}
                  />
                  {phraseSearch && (
                    <button className="phrases-search-clear" onClick={() => setPhraseSearch('')}>×</button>
                  )}
                </div>
                <div className="phrases-top-cat-pills">
                  <button
                    className={`phrases-cat-pill ${phraseFilterCat === 'all' ? 'active' : ''}`}
                    onClick={() => setPhraseFilterCat('all')}
                  >
                    전체
                  </button>
                  {PHRASE_CATEGORIES.map(c => (
                    <button
                      key={c}
                      className={`phrases-cat-pill ${phraseFilterCat === c ? 'active' : ''}`}
                      onClick={() => setPhraseFilterCat(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Phrase Cards */}
            <div className="phrases-top-grid">
              {filteredPhrases.length === 0 && (
                <div className="phrases-top-empty">
                  {phrases.length === 0
                    ? '저장된 문구가 없습니다. "새 문구" 버튼을 눌러 추가해보세요.'
                    : '검색 결과가 없습니다.'}
                </div>
              )}
              {filteredPhrases.map(p => (
                <div key={p.id} className="phrases-top-card phrases-simple-card">
                  <div className="phrases-simple-content">{p.content}</div>
                  <div className="phrases-simple-footer">
                    <span className="phrases-top-card-cat">{p.category}</span>
                    <div className="phrases-top-card-actions">
                      <button
                        className={`btn btn-sm ${copiedId === p.id ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => handleCopyPhrase(p)}
                      >
                        {copiedId === p.id ? '복사됨!' : '복사'}
                      </button>
                      <button className="btn btn-sm btn-ghost" onClick={() => startEditPhrase(p)}>수정</button>
                      <button className="btn btn-sm btn-ghost phrases-top-delete" onClick={() => { if (confirm('이 문구를 삭제하시겠습니까?')) deletePhrase(p.id); }}>삭제</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ===== Todo Section ===== */}
      <div className="todo-toolbar">
        <div className="todo-tabs">
          <button
            className={`tab-btn ${viewTab === 'active' ? 'active' : ''}`}
            onClick={() => { setViewTab('active'); setSelectedIds(new Set()); }}
          >
            진행 중 ({activeTodoCount})
          </button>
          <button
            className={`tab-btn ${viewTab === 'completed' ? 'active' : ''}`}
            onClick={() => { setViewTab('completed'); setSelectedIds(new Set()); }}
          >
            완료 ({completedTodoCount})
          </button>
        </div>

        <div className="todo-search">
          <input
            type="text"
            placeholder="할 일 검색..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="todo-search-input"
          />
          {searchQuery && (
            <button className="todo-search-clear" onClick={() => setSearchQuery('')}>×</button>
          )}
        </div>

        <div className="todo-filters">
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value as TodoCategory | 'all')}
            className="todo-filter-select"
          >
            <option value="all">전체 종류</option>
            {allCategories.map(c => {
              const info = getCategoryInfo(c, customCategories);
              return <option key={c} value={c}>{info.label}</option>;
            })}
          </select>

          <select
            value={filterPriority}
            onChange={e => setFilterPriority(e.target.value as TodoPriority | 'all')}
            className="todo-filter-select"
          >
            <option value="all">전체 우선순위</option>
            {ALL_PRIORITIES.map(p => (
              <option key={p} value={p}>{PRIORITY_MAP[p].label}</option>
            ))}
          </select>

          {viewTab === 'completed' && (
            <label className="todo-hide-toggle">
              <input type="checkbox" checked={hideCompleted} onChange={e => setHideCompleted(e.target.checked)} />
              완료 항목 숨기기
            </label>
          )}
        </div>

        {selectedIds.size > 0 && (
          <div className="todo-bulk-actions">
            <span className="todo-bulk-count">{selectedIds.size}개 선택</span>
            {viewTab === 'active' && (
              <button className="btn btn-sm btn-primary" onClick={handleBulkComplete}>일괄 완료</button>
            )}
            <button className="btn btn-sm btn-ghost todo-bulk-delete" onClick={handleBulkDelete}>일괄 삭제</button>
          </div>
        )}
      </div>

      {/* Project cards grid */}
      <div className="todo-project-grid">
        {projectIdsToShow.map(projectId => {
          const projectTodos = groupedByProject.get(projectId) || [];
          const projectColor = getProjectColor(projectId);

          return (
            <div key={projectId} className="todo-project-card" style={{ borderTopColor: projectColor }}>
              <div className="todo-project-card-header">
                <div className="todo-project-card-title">
                  <span className="todo-project-dot" style={{ background: projectColor }} />
                  <h3>{getProjectName(projectId)}</h3>
                  <span className="todo-project-count">{projectTodos.length}</span>
                </div>
                <div className="todo-project-card-actions">
                  {viewTab === 'active' && projectTodos.length > 0 && (
                    <button className="btn btn-sm btn-ghost" onClick={() => selectAllInProject(projectId)}>
                      전체 선택
                    </button>
                  )}
                  {viewTab === 'active' && (
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => {
                        resetForm();
                        setShowAddForm(projectId);
                        setFormData(prev => ({ ...prev, projectId }));
                      }}
                    >
                      + 추가
                    </button>
                  )}
                </div>
              </div>

              {/* Add/Edit Form */}
              {showAddForm === projectId && (
                <div className="todo-form">
                  <input
                    type="text"
                    placeholder="할 일 제목"
                    value={formData.title}
                    onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    className="todo-form-input"
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(projectId); } }}
                  />
                  <textarea
                    placeholder="메모 / 상세 내용 (선택)"
                    value={formData.memo}
                    onChange={e => setFormData(prev => ({ ...prev, memo: e.target.value }))}
                    className="todo-form-textarea"
                    rows={2}
                  />
                  <div className="todo-form-row">
                    <div className="todo-category-combobox">
                      {categoryMode === 'select' ? (
                        <div className="todo-category-combo-row">
                          <select
                            value={formData.category}
                            onChange={e => {
                              const val = e.target.value;
                              if (val === '__custom__') {
                                setCategoryMode('custom');
                                setCustomCategoryInput('');
                              } else {
                                setFormData(prev => ({ ...prev, category: val }));
                              }
                            }}
                            className="todo-form-select"
                          >
                            {allCategories.map(c => {
                              const info = getCategoryInfo(c, customCategories);
                              return <option key={c} value={c}>{info.label}</option>;
                            })}
                            <option value="__custom__">+ 직접 입력...</option>
                          </select>
                          <button
                            type="button"
                            className="btn btn-sm btn-ghost todo-category-manage-btn"
                            onClick={() => setShowCategoryManager(!showCategoryManager)}
                            title="카테고리 관리"
                          >
                            ⚙
                          </button>
                        </div>
                      ) : (
                        <div className="todo-category-custom-row">
                          <input
                            type="text"
                            placeholder="새 카테고리 이름 입력"
                            value={customCategoryInput}
                            onChange={e => setCustomCategoryInput(e.target.value)}
                            className="todo-form-input todo-category-custom-input"
                            autoFocus
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const trimmed = customCategoryInput.trim();
                                if (trimmed) {
                                  addCustomCategory(trimmed);
                                  setFormData(prev => ({ ...prev, category: trimmed }));
                                }
                                setCategoryMode('select');
                                setCustomCategoryInput('');
                              } else if (e.key === 'Escape') {
                                setCategoryMode('select');
                                setCustomCategoryInput('');
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={() => {
                              const trimmed = customCategoryInput.trim();
                              if (trimmed) {
                                addCustomCategory(trimmed);
                                setFormData(prev => ({ ...prev, category: trimmed }));
                              }
                              setCategoryMode('select');
                              setCustomCategoryInput('');
                            }}
                          >
                            확인
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-ghost"
                            onClick={() => { setCategoryMode('select'); setCustomCategoryInput(''); }}
                          >
                            취소
                          </button>
                        </div>
                      )}
                      {showCategoryManager && customCategories.length > 0 && (
                        <div className="todo-category-manager">
                          <div className="todo-category-manager-title">커스텀 카테고리 관리</div>
                          {customCategories.map(cat => (
                            <div key={cat} className="todo-category-manager-item">
                              {editingCategory === cat ? (
                                <>
                                  <input
                                    type="text"
                                    value={editCategoryInput}
                                    onChange={e => setEditCategoryInput(e.target.value)}
                                    className="todo-form-input todo-category-edit-input"
                                    autoFocus
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') {
                                        const trimmed = editCategoryInput.trim();
                                        if (trimmed && trimmed !== cat) updateCustomCategory(cat, trimmed);
                                        setEditingCategory(null);
                                      } else if (e.key === 'Escape') {
                                        setEditingCategory(null);
                                      }
                                    }}
                                  />
                                  <button className="btn btn-sm btn-primary" onClick={() => { const trimmed = editCategoryInput.trim(); if (trimmed && trimmed !== cat) updateCustomCategory(cat, trimmed); setEditingCategory(null); }}>저장</button>
                                  <button className="btn btn-sm btn-ghost" onClick={() => setEditingCategory(null)}>취소</button>
                                </>
                              ) : (
                                <>
                                  <span className="todo-category-manager-label" style={{ color: getCategoryInfo(cat, customCategories).color }}>{cat}</span>
                                  <button className="btn btn-sm btn-ghost" onClick={() => { setEditingCategory(cat); setEditCategoryInput(cat); }}>수정</button>
                                  <button className="btn btn-sm btn-ghost todo-delete-btn" onClick={() => { if (confirm(`"${cat}" 카테고리를 삭제하시겠습니까?`)) deleteCustomCategory(cat); }}>삭제</button>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <select
                      value={formData.priority}
                      onChange={e => setFormData(prev => ({ ...prev, priority: e.target.value as TodoPriority }))}
                      className="todo-form-select"
                    >
                      {ALL_PRIORITIES.map(p => (
                        <option key={p} value={p}>{PRIORITY_MAP[p].label}</option>
                      ))}
                    </select>

                    <div className="todo-form-due">
                      <input
                        type="date"
                        value={formData.dueDate}
                        onChange={e => setFormData(prev => ({ ...prev, dueDate: e.target.value, dueDateTBD: false }))}
                        className="todo-form-date"
                        disabled={formData.dueDateTBD}
                      />
                      <label className="todo-form-tbd">
                        <input
                          type="checkbox"
                          checked={formData.dueDateTBD}
                          onChange={e => setFormData(prev => ({ ...prev, dueDateTBD: e.target.checked, dueDate: '' }))}
                        />
                        TBD
                      </label>
                    </div>
                  </div>
                  <div className="todo-form-actions">
                    <button className="btn btn-sm btn-primary" onClick={() => handleSubmit(projectId)}>
                      {editingTodo ? '수정' : '추가'}
                    </button>
                    <button className="btn btn-sm btn-ghost" onClick={resetForm}>취소</button>
                  </div>
                </div>
              )}

              {/* Todo items */}
              <div className="todo-items-list">
                {projectTodos.length === 0 && showAddForm !== projectId && (
                  <div className="todo-empty">할 일이 없습니다</div>
                )}
                {projectTodos.map(todo => (
                  <div
                    key={todo.id}
                    className={`todo-item ${dragItem === todo.id ? 'todo-item-dragging' : ''} ${dragOverItem === todo.id ? 'todo-item-dragover' : ''} ${todo.completed ? 'todo-item-done' : ''}`}
                    draggable={viewTab === 'active'}
                    onDragStart={() => handleDragStart(todo.id, projectId)}
                    onDragOver={e => handleDragOver(e, todo.id, projectId)}
                    onDrop={() => handleDrop(projectId)}
                    onDragEnd={() => { setDragItem(null); setDragOverItem(null); }}
                  >
                    <div className="todo-item-left">
                      <input
                        type="checkbox"
                        className="todo-item-select"
                        checked={selectedIds.has(todo.id)}
                        onChange={() => toggleSelect(todo.id)}
                      />
                      {viewTab === 'active' && <span className="todo-drag-handle" title="드래그하여 정렬">⠿</span>}
                      <button
                        className={`todo-check ${todo.completed ? 'todo-check-done' : ''}`}
                        onClick={() => toggleComplete(todo.id)}
                        title={todo.completed ? '미완료로 변경' : '완료 처리'}
                      >
                        {todo.completed ? '✓' : ''}
                      </button>
                      <div className="todo-item-content">
                        <div className="todo-item-title-row">
                          <span className={`todo-item-title ${todo.completed ? 'todo-title-done' : ''}`}>{todo.title}</span>
                          <span className="todo-category-badge" style={{ background: getCategoryInfo(todo.category, customCategories).color + '22', color: getCategoryInfo(todo.category, customCategories).color, borderColor: getCategoryInfo(todo.category, customCategories).color + '44' }}>
                            {getCategoryInfo(todo.category, customCategories).label}
                          </span>
                          <span className="todo-priority-badge" style={{ background: PRIORITY_MAP[todo.priority].color + '22', color: PRIORITY_MAP[todo.priority].color, borderColor: PRIORITY_MAP[todo.priority].color + '44' }}>
                            {PRIORITY_MAP[todo.priority].label}
                          </span>
                        </div>
                        {todo.memo && <div className="todo-item-memo">{todo.memo}</div>}
                        <div className="todo-item-meta">
                          {getDueDateDisplay(todo)}
                          {todo.completed && todo.completedAt && (
                            <span className="todo-completed-date">완료: {new Date(todo.completedAt).toLocaleDateString('ko-KR')}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="todo-item-actions">
                      {!todo.completed && (
                        <button className="btn btn-sm btn-ghost" onClick={() => startEdit(todo)} title="수정">✎</button>
                      )}
                      <button className="btn btn-sm btn-ghost todo-delete-btn" onClick={() => deleteTodo(todo.id)} title="삭제">×</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Card for unassigned todos if exist */}
        {groupedByProject.has('') && !projectIdsToShow.includes('') && (() => {
          const unassigned = groupedByProject.get('') || [];
          return (
            <div className="todo-project-card" style={{ borderTopColor: '#475569' }}>
              <div className="todo-project-card-header">
                <div className="todo-project-card-title">
                  <span className="todo-project-dot" style={{ background: '#475569' }} />
                  <h3>프로젝트 미지정</h3>
                  <span className="todo-project-count">{unassigned.length}</span>
                </div>
              </div>
              <div className="todo-items-list">
                {unassigned.map(todo => (
                  <div key={todo.id} className={`todo-item ${todo.completed ? 'todo-item-done' : ''}`}>
                    <div className="todo-item-left">
                      <button className={`todo-check ${todo.completed ? 'todo-check-done' : ''}`} onClick={() => toggleComplete(todo.id)}>
                        {todo.completed ? '✓' : ''}
                      </button>
                      <span className={`todo-item-title ${todo.completed ? 'todo-title-done' : ''}`}>{todo.title}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
