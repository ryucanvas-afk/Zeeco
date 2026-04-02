import { useState, useRef, useMemo } from 'react';
import { useNotes } from '../context/NoteContext';
import { useProjects } from '../context/ProjectContext';
import type { NoteItem, NoteColor } from '../types';

const NOTE_COLORS: { value: NoteColor; label: string; bg: string }[] = [
  { value: 'default', label: '기본', bg: '#f8fafc' },
  { value: 'blue', label: '파랑', bg: '#dbeafe' },
  { value: 'green', label: '초록', bg: '#dcfce7' },
  { value: 'yellow', label: '노랑', bg: '#fef9c3' },
  { value: 'red', label: '빨강', bg: '#fee2e2' },
  { value: 'purple', label: '보라', bg: '#e9d5ff' },
  { value: 'pink', label: '분홍', bg: '#fce7f3' },
];

const COMMON_PROJECT_ID = '__COMMON__';

function getNoteColorBg(color: NoteColor): string {
  return NOTE_COLORS.find(c => c.value === color)?.bg || '#f8fafc';
}

export default function NotesList() {
  const { notes, addNote, updateNote, deleteNote, toggleHideNote, togglePinNote, reorderNotes, projectOrder, reorderProjectCards } = useNotes();
  const { projects } = useProjects();

  const [showHidden, setShowHidden] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProjectId, setFilterProjectId] = useState('');
  const [showAddForm, setShowAddForm] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [formData, setFormData] = useState({ title: '', content: '', color: 'default' as NoteColor, projectId: '' });

  // Drag state for notes
  const dragNote = useRef<string | null>(null);
  const dragOverNote = useRef<string | null>(null);
  const dragProjectId = useRef<string | null>(null);

  // Drag state for project cards
  const dragProjectCard = useRef<string | null>(null);
  const dragOverProjectCard = useRef<string | null>(null);

  const visibleProjects = useMemo(() => {
    return projects.filter(p => !p.hidden);
  }, [projects]);

  const filteredNotes = useMemo(() => {
    let result = notes;
    if (!showHidden) {
      result = result.filter(n => !n.hidden);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(n => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q));
    }
    if (filterProjectId) {
      result = result.filter(n => n.projectId === filterProjectId);
    }
    return result;
  }, [notes, showHidden, searchQuery, filterProjectId]);

  const groupedNotes = useMemo(() => {
    const groups: Record<string, NoteItem[]> = {};
    // Common notes first
    const commonNotes = filteredNotes.filter(n => n.projectId === COMMON_PROJECT_ID);
    if (commonNotes.length > 0) {
      groups[COMMON_PROJECT_ID] = commonNotes.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return a.sortOrder - b.sortOrder;
      });
    }
    // Then by project
    visibleProjects.forEach(p => {
      const pNotes = filteredNotes.filter(n => n.projectId === p.id);
      if (pNotes.length > 0) {
        groups[p.id] = pNotes.sort((a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
          return a.sortOrder - b.sortOrder;
        });
      }
    });
    return groups;
  }, [filteredNotes, visibleProjects]);

  const sortedProjectIds = useMemo(() => {
    const allIds = Object.keys(groupedNotes).filter(id => id !== COMMON_PROJECT_ID);
    const ordered: string[] = [];
    // Follow projectOrder first
    projectOrder.forEach(id => {
      if (allIds.includes(id)) ordered.push(id);
    });
    // Then add any remaining
    allIds.forEach(id => {
      if (!ordered.includes(id)) ordered.push(id);
    });
    return ordered;
  }, [groupedNotes, projectOrder]);

  const getProjectName = (pid: string) => {
    if (pid === COMMON_PROJECT_ID) return '공통 노트';
    return projects.find(p => p.id === pid)?.name || '알 수 없는 프로젝트';
  };

  const getProjectColor = (pid: string) => {
    if (pid === COMMON_PROJECT_ID) return '#6b7280';
    return projects.find(p => p.id === pid)?.color || '#3b82f6';
  };

  const openAddForm = (projectId: string) => {
    setFormData({ title: '', content: '', color: 'default', projectId });
    setShowAddForm(projectId);
    setEditingNote(null);
  };

  const openEditForm = (note: NoteItem) => {
    setFormData({ title: note.title, content: note.content, color: note.color, projectId: note.projectId });
    setEditingNote(note.id);
    setShowAddForm(null);
  };

  const handleSubmitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() && !formData.content.trim()) return;
    addNote({
      projectId: showAddForm || COMMON_PROJECT_ID,
      title: formData.title.trim(),
      content: formData.content,
      color: formData.color,
    });
    setShowAddForm(null);
    setFormData({ title: '', content: '', color: 'default', projectId: '' });
  };

  const handleSubmitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNote) return;
    updateNote(editingNote, {
      title: formData.title.trim(),
      content: formData.content,
      color: formData.color,
    });
    setEditingNote(null);
    setFormData({ title: '', content: '', color: 'default', projectId: '' });
  };

  // Note drag handlers
  const handleNoteDragStart = (noteId: string, projectId: string) => {
    dragNote.current = noteId;
    dragProjectId.current = projectId;
  };

  const handleNoteDragOver = (e: React.DragEvent, noteId: string) => {
    e.preventDefault();
    dragOverNote.current = noteId;
  };

  const handleNoteDrop = (e: React.DragEvent, targetProjectId: string) => {
    e.preventDefault();
    if (!dragNote.current || !dragOverNote.current || dragProjectId.current !== targetProjectId) {
      dragNote.current = null;
      dragOverNote.current = null;
      dragProjectId.current = null;
      return;
    }
    const projectNotes = (groupedNotes[targetProjectId] || []);
    const ids = projectNotes.map(n => n.id);
    const fromIdx = ids.indexOf(dragNote.current);
    const toIdx = ids.indexOf(dragOverNote.current);
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) {
      dragNote.current = null;
      dragOverNote.current = null;
      dragProjectId.current = null;
      return;
    }
    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, dragNote.current);
    reorderNotes(targetProjectId, ids);
    dragNote.current = null;
    dragOverNote.current = null;
    dragProjectId.current = null;
  };

  // Project card drag handlers
  const handleProjectDragStart = (projectId: string) => {
    dragProjectCard.current = projectId;
  };

  const handleProjectDragOver = (e: React.DragEvent, projectId: string) => {
    e.preventDefault();
    dragOverProjectCard.current = projectId;
  };

  const handleProjectDrop = () => {
    if (!dragProjectCard.current || !dragOverProjectCard.current || dragProjectCard.current === dragOverProjectCard.current) {
      dragProjectCard.current = null;
      dragOverProjectCard.current = null;
      return;
    }
    const ids = [...sortedProjectIds];
    const fromIdx = ids.indexOf(dragProjectCard.current);
    const toIdx = ids.indexOf(dragOverProjectCard.current);
    if (fromIdx === -1 || toIdx === -1) return;
    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, dragProjectCard.current);
    reorderProjectCards(ids);
    dragProjectCard.current = null;
    dragOverProjectCard.current = null;
  };

  const handleDeleteNote = (noteId: string) => {
    if (confirm('이 노트를 삭제하시겠습니까?')) {
      deleteNote(noteId);
    }
  };

  const renderNoteCard = (note: NoteItem, projectId: string) => {
    const isEditing = editingNote === note.id;

    if (isEditing) {
      return (
        <div key={note.id} className="note-card note-card-editing" style={{ backgroundColor: getNoteColorBg(formData.color) }}>
          <form onSubmit={handleSubmitEdit}>
            <input
              className="note-form-input"
              value={formData.title}
              onChange={e => setFormData(f => ({ ...f, title: e.target.value }))}
              placeholder="제목"
              autoFocus
            />
            <textarea
              className="note-form-textarea"
              value={formData.content}
              onChange={e => setFormData(f => ({ ...f, content: e.target.value }))}
              placeholder="내용을 입력하세요..."
              rows={4}
            />
            <div className="note-form-colors">
              {NOTE_COLORS.map(c => (
                <button
                  key={c.value}
                  type="button"
                  className={`note-color-btn ${formData.color === c.value ? 'active' : ''}`}
                  style={{ backgroundColor: c.bg }}
                  onClick={() => setFormData(f => ({ ...f, color: c.value }))}
                  title={c.label}
                />
              ))}
            </div>
            <div className="note-form-actions">
              <button type="submit" className="btn btn-sm btn-primary">저장</button>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditingNote(null)}>취소</button>
            </div>
          </form>
        </div>
      );
    }

    return (
      <div
        key={note.id}
        className={`note-card ${note.hidden ? 'note-hidden' : ''} ${note.pinned ? 'note-pinned' : ''}`}
        style={{ backgroundColor: getNoteColorBg(note.color), opacity: note.hidden ? 0.5 : 1 }}
        draggable
        onDragStart={() => handleNoteDragStart(note.id, projectId)}
        onDragOver={e => handleNoteDragOver(e, note.id)}
        onDrop={e => handleNoteDrop(e, projectId)}
      >
        <div className="note-card-header">
          <span className="note-drag-handle" title="드래그하여 순서 변경">⠿</span>
          {note.pinned && <span className="note-pin-badge" title="고정됨">📌</span>}
          <span className="note-card-title">{note.title || '(제목 없음)'}</span>
          <div className="note-card-actions">
            <button className="note-action-btn" onClick={() => togglePinNote(note.id)} title={note.pinned ? '고정 해제' : '고정'}>
              {note.pinned ? '📌' : '📍'}
            </button>
            <button className="note-action-btn" onClick={() => toggleHideNote(note.id)} title={note.hidden ? '보이기' : '숨기기'}>
              {note.hidden ? '👁' : '🙈'}
            </button>
            <button className="note-action-btn" onClick={() => openEditForm(note)} title="편집">✎</button>
            <button className="note-action-btn note-delete-btn" onClick={() => handleDeleteNote(note.id)} title="삭제">×</button>
          </div>
        </div>
        {note.content && (
          <div className="note-card-content">
            {note.content.split('\n').map((line, i) => (
              <span key={i}>{line}{i < note.content.split('\n').length - 1 && <br />}</span>
            ))}
          </div>
        )}
        <div className="note-card-footer">
          <span className="note-date">{new Date(note.updatedAt).toLocaleDateString('ko-KR')}</span>
        </div>
      </div>
    );
  };

  const renderAddForm = (projectId: string) => {
    if (showAddForm !== projectId) return null;
    return (
      <div className="note-card note-card-editing" style={{ backgroundColor: getNoteColorBg(formData.color) }}>
        <form onSubmit={handleSubmitAdd}>
          <input
            className="note-form-input"
            value={formData.title}
            onChange={e => setFormData(f => ({ ...f, title: e.target.value }))}
            placeholder="제목"
            autoFocus
          />
          <textarea
            className="note-form-textarea"
            value={formData.content}
            onChange={e => setFormData(f => ({ ...f, content: e.target.value }))}
            placeholder="내용을 입력하세요..."
            rows={4}
          />
          <div className="note-form-colors">
            {NOTE_COLORS.map(c => (
              <button
                key={c.value}
                type="button"
                className={`note-color-btn ${formData.color === c.value ? 'active' : ''}`}
                style={{ backgroundColor: c.bg }}
                onClick={() => setFormData(f => ({ ...f, color: c.value }))}
                title={c.label}
              />
            ))}
          </div>
          <div className="note-form-actions">
            <button type="submit" className="btn btn-sm btn-primary">추가</button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setShowAddForm(null)}>취소</button>
          </div>
        </form>
      </div>
    );
  };

  return (
    <div className="notes-page">
      <div className="notes-page-header">
        <h2>프로젝트 노트</h2>
        <span className="notes-count">총 {filteredNotes.length}개</span>
      </div>

      {/* Toolbar */}
      <div className="notes-toolbar">
        <div className="notes-search">
          <input
            className="notes-search-input"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="노트 검색..."
          />
          {searchQuery && (
            <button className="notes-search-clear" onClick={() => setSearchQuery('')}>×</button>
          )}
        </div>
        <select
          className="notes-filter-select"
          value={filterProjectId}
          onChange={e => setFilterProjectId(e.target.value)}
        >
          <option value="">전체 프로젝트</option>
          <option value={COMMON_PROJECT_ID}>공통 노트</option>
          {visibleProjects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <label className="notes-hide-toggle">
          <input type="checkbox" checked={showHidden} onChange={e => setShowHidden(e.target.checked)} />
          숨긴 노트 보기
        </label>
      </div>

      {/* Common Notes Section */}
      <div className="notes-project-card notes-project-card-common">
        <div className="notes-project-card-header">
          <div className="notes-project-card-title">
            <span className="notes-project-dot" style={{ backgroundColor: '#6b7280' }} />
            <h3>공통 노트</h3>
            <span className="notes-project-count">{(groupedNotes[COMMON_PROJECT_ID] || []).length}</span>
          </div>
          <button className="btn btn-sm btn-primary" onClick={() => openAddForm(COMMON_PROJECT_ID)}>+ 노트 추가</button>
        </div>
        <div className="notes-grid">
          {renderAddForm(COMMON_PROJECT_ID)}
          {(groupedNotes[COMMON_PROJECT_ID] || []).map(note => renderNoteCard(note, COMMON_PROJECT_ID))}
          {!groupedNotes[COMMON_PROJECT_ID]?.length && showAddForm !== COMMON_PROJECT_ID && (
            <div className="notes-empty-hint">노트가 없습니다. + 노트 추가 버튼을 클릭하세요.</div>
          )}
        </div>
      </div>

      {/* Project Notes */}
      <div className="notes-project-list">
        {sortedProjectIds.map(pid => (
          <div
            key={pid}
            className="notes-project-card"
            draggable
            onDragStart={() => handleProjectDragStart(pid)}
            onDragOver={e => handleProjectDragOver(e, pid)}
            onDrop={handleProjectDrop}
          >
            <div className="notes-project-card-header">
              <div className="notes-project-card-title">
                <span className="notes-drag-handle" title="드래그하여 순서 변경">⠿</span>
                <span className="notes-project-dot" style={{ backgroundColor: getProjectColor(pid) }} />
                <h3>{getProjectName(pid)}</h3>
                <span className="notes-project-count">{(groupedNotes[pid] || []).length}</span>
              </div>
              <button className="btn btn-sm btn-primary" onClick={() => openAddForm(pid)}>+ 노트 추가</button>
            </div>
            <div className="notes-grid">
              {renderAddForm(pid)}
              {(groupedNotes[pid] || []).map(note => renderNoteCard(note, pid))}
            </div>
          </div>
        ))}
      </div>

      {/* Add note to new project */}
      {!filterProjectId && (
        <div className="notes-add-to-project">
          <select
            className="notes-filter-select"
            value=""
            onChange={e => {
              if (e.target.value) openAddForm(e.target.value);
            }}
          >
            <option value="">다른 프로젝트에 노트 추가...</option>
            <option value={COMMON_PROJECT_ID}>공통 노트</option>
            {visibleProjects.filter(p => !groupedNotes[p.id]).map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
