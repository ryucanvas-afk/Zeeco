import { useState, useRef, useMemo } from 'react';
import { useTodos } from '../context/TodoContext';
import { useProjects } from '../context/ProjectContext';
import type { TodoItem, TodoCategory, TodoPriority, QuickPhrase } from '../types';

const CATEGORY_MAP: Record<TodoCategory, { label: string; color: string }> = {
  mail_write: { label: '메일 작성', color: '#3b82f6' },
  mail_reply: { label: '메일 회신', color: '#06b6d4' },
  drawing: { label: '도면', color: '#f59e0b' },
  eic_request: { label: '전계장팀 요청', color: '#8b5cf6' },
  confirmation: { label: '확인 사항', color: '#10b981' },
  purchase_order: { label: '발주', color: '#ef4444' },
  general_request: { label: '일반 요청', color: '#94a3b8' },
};

const PRIORITY_MAP: Record<TodoPriority, { label: string; color: string; order: number }> = {
  urgent: { label: '긴급', color: '#ef4444', order: 0 },
  high: { label: '높음', color: '#f59e0b', order: 1 },
  normal: { label: '보통', color: '#3b82f6', order: 2 },
  low: { label: '낮음', color: '#94a3b8', order: 3 },
};

const ALL_CATEGORIES = Object.keys(CATEGORY_MAP) as TodoCategory[];
const ALL_PRIORITIES = Object.keys(PRIORITY_MAP) as TodoPriority[];

const PHRASE_CATEGORIES = ['인사/마무리', '요청', '확인', '회신', '납기', '검수', '일반'];

type ViewTab = 'active' | 'completed';

export default function TodoList() {
  const { todos, addTodo, updateTodo, deleteTodo, toggleComplete, bulkComplete, bulkDelete, reorderTodos, phrases, addPhrase, updatePhrase, deletePhrase } = useTodos();
  const { projects } = useProjects();
  const visibleProjects = projects.filter(p => !p.hidden);

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

  // Phrases panel state
  const [showPhrases, setShowPhrases] = useState(false);
  const [phraseSearch, setPhraseSearch] = useState('');
  const [phraseFilterCat, setPhraseFilterCat] = useState<string>('all');
  const [editingPhrase, setEditingPhrase] = useState<string | null>(null);
  const [phraseForm, setPhraseForm] = useState({ title: '', content: '', category: '일반' });
  const [showPhraseForm, setShowPhraseForm] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
    if (!phraseForm.title.trim() || !phraseForm.content.trim()) return;
    if (editingPhrase) {
      updatePhrase(editingPhrase, { title: phraseForm.title, content: phraseForm.content, category: phraseForm.category });
    } else {
      addPhrase({ title: phraseForm.title, content: phraseForm.content, category: phraseForm.category });
    }
    setPhraseForm({ title: '', content: '', category: '일반' });
    setShowPhraseForm(false);
    setEditingPhrase(null);
  };

  const startEditPhrase = (p: QuickPhrase) => {
    setEditingPhrase(p.id);
    setPhraseForm({ title: p.title, content: p.content, category: p.category });
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
    // Include "no project" group
    for (const todo of filteredTodos) {
      const group = map.get(todo.projectId) || [];
      group.push(todo);
      map.set(todo.projectId, group);
    }
    // Sort within each group
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

  const getProjectName = (projectId: string) => {
    if (!projectId) return '프로젝트 미지정';
    const p = projects.find(p => p.id === projectId);
    return p ? `${p.projectNo ? p.projectNo + ' - ' : ''}${p.name}` : '삭제된 프로젝트';
  };

  const getProjectColor = (projectId: string) => {
    const p = projects.find(p => p.id === projectId);
    return p?.color || '#475569';
  };

  // Which projects to show cards for
  const projectIdsToShow = useMemo(() => {
    const idsWithTodos = Array.from(groupedByProject.keys());
    // Show all visible projects + any with todos (even deleted)
    const allIds = new Set([...visibleProjects.map(p => p.id), ...idsWithTodos]);
    // Sort: projects with todos first, then alphabetically
    return Array.from(allIds).sort((a, b) => {
      const aHas = groupedByProject.has(a) ? 0 : 1;
      const bHas = groupedByProject.has(b) ? 0 : 1;
      if (aHas !== bHas) return aHas - bHas;
      return getProjectName(a).localeCompare(getProjectName(b));
    });
  }, [groupedByProject, visibleProjects]);

  const activeTodoCount = todos.filter(t => !t.completed).length;
  const completedTodoCount = todos.filter(t => t.completed).length;

  return (
    <div className={`todo-page ${showPhrases ? 'todo-page-with-phrases' : ''}`}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>To-Do List</h2>
          <p className="page-desc">프로젝트별 할 일 관리</p>
        </div>
        <button
          className={`btn btn-sm ${showPhrases ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setShowPhrases(!showPhrases)}
        >
          {showPhrases ? '문구 패널 닫기' : '자주 쓰는 문구'}
        </button>
      </div>

      {/* Top bar: tabs, search, filters */}
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
            {ALL_CATEGORIES.map(c => (
              <option key={c} value={c}>{CATEGORY_MAP[c].label}</option>
            ))}
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
                    <select
                      value={formData.category}
                      onChange={e => setFormData(prev => ({ ...prev, category: e.target.value as TodoCategory }))}
                      className="todo-form-select"
                    >
                      {ALL_CATEGORIES.map(c => (
                        <option key={c} value={c}>{CATEGORY_MAP[c].label}</option>
                      ))}
                    </select>

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
                          <span className="todo-category-badge" style={{ background: CATEGORY_MAP[todo.category].color + '22', color: CATEGORY_MAP[todo.category].color, borderColor: CATEGORY_MAP[todo.category].color + '44' }}>
                            {CATEGORY_MAP[todo.category].label}
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

      {/* Quick Phrases Side Panel */}
      {showPhrases && (
        <div className="phrases-panel">
          <div className="phrases-panel-header">
            <h3>자주 쓰는 문구</h3>
            <button className="btn btn-sm btn-primary" onClick={() => { setShowPhraseForm(true); setEditingPhrase(null); setPhraseForm({ title: '', content: '', category: '일반' }); }}>
              + 추가
            </button>
          </div>

          <div className="phrases-panel-filters">
            <input
              type="text"
              placeholder="문구 검색..."
              value={phraseSearch}
              onChange={e => setPhraseSearch(e.target.value)}
              className="todo-search-input"
            />
            <select
              value={phraseFilterCat}
              onChange={e => setPhraseFilterCat(e.target.value)}
              className="todo-filter-select"
            >
              <option value="all">전체</option>
              {PHRASE_CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {showPhraseForm && (
            <div className="phrases-form">
              <input
                type="text"
                placeholder="문구 제목 (예: 견적 요청)"
                value={phraseForm.title}
                onChange={e => setPhraseForm(prev => ({ ...prev, title: e.target.value }))}
                className="todo-form-input"
                autoFocus
              />
              <textarea
                placeholder="문구 내용을 입력하세요..."
                value={phraseForm.content}
                onChange={e => setPhraseForm(prev => ({ ...prev, content: e.target.value }))}
                className="todo-form-textarea"
                rows={4}
              />
              <div className="phrases-form-bottom">
                <select
                  value={phraseForm.category}
                  onChange={e => setPhraseForm(prev => ({ ...prev, category: e.target.value }))}
                  className="todo-form-select"
                >
                  {PHRASE_CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <div className="todo-form-actions">
                  <button className="btn btn-sm btn-primary" onClick={handlePhraseSubmit}>
                    {editingPhrase ? '수정' : '저장'}
                  </button>
                  <button className="btn btn-sm btn-ghost" onClick={() => { setShowPhraseForm(false); setEditingPhrase(null); }}>취소</button>
                </div>
              </div>
            </div>
          )}

          <div className="phrases-list">
            {filteredPhrases.length === 0 && (
              <div className="todo-empty">저장된 문구가 없습니다</div>
            )}
            {filteredPhrases.map(p => (
              <div key={p.id} className="phrase-card">
                <div className="phrase-card-top">
                  <span className="phrase-title">{p.title}</span>
                  <span className="phrase-cat-badge">{p.category}</span>
                </div>
                <div className="phrase-content">{p.content}</div>
                <div className="phrase-card-actions">
                  <button
                    className={`btn btn-sm ${copiedId === p.id ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => handleCopyPhrase(p)}
                  >
                    {copiedId === p.id ? '복사됨!' : '복사'}
                  </button>
                  <button className="btn btn-sm btn-ghost" onClick={() => startEditPhrase(p)}>수정</button>
                  <button className="btn btn-sm btn-ghost todo-delete-btn" onClick={() => deletePhrase(p.id)}>삭제</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
