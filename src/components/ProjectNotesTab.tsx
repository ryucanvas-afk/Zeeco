import { useState, useRef, useMemo } from 'react';
import { useNotes } from '../context/NoteContext';
import type { Project, NoteItem, NoteColor } from '../types';

const NOTE_COLORS: { value: NoteColor; label: string; bg: string }[] = [
  { value: 'default', label: '기본', bg: '#f8fafc' },
  { value: 'blue', label: '파랑', bg: '#dbeafe' },
  { value: 'green', label: '초록', bg: '#dcfce7' },
  { value: 'yellow', label: '노랑', bg: '#fef9c3' },
  { value: 'red', label: '빨강', bg: '#fee2e2' },
  { value: 'purple', label: '보라', bg: '#e9d5ff' },
  { value: 'pink', label: '분홍', bg: '#fce7f3' },
];

function getNoteColorBg(color: NoteColor): string {
  return NOTE_COLORS.find(c => c.value === color)?.bg || '#f8fafc';
}

interface Props {
  project: Project;
}

export default function ProjectNotesTab({ project }: Props) {
  const { notes, addNote, updateNote, deleteNote, toggleHideNote, togglePinNote, reorderNotes } = useNotes();

  const [showHidden, setShowHidden] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [formData, setFormData] = useState({ title: '', content: '', color: 'default' as NoteColor });

  const dragNote = useRef<string | null>(null);
  const dragOverNote = useRef<string | null>(null);

  const projectNotes = useMemo(() => {
    let result = notes.filter(n => n.projectId === project.id);
    if (!showHidden) {
      result = result.filter(n => !n.hidden);
    }
    return result.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return a.sortOrder - b.sortOrder;
    });
  }, [notes, project.id, showHidden]);

  const openAddForm = () => {
    setFormData({ title: '', content: '', color: 'default' });
    setShowAddForm(true);
    setEditingNote(null);
  };

  const openEditForm = (note: NoteItem) => {
    setFormData({ title: note.title, content: note.content, color: note.color });
    setEditingNote(note.id);
    setShowAddForm(false);
  };

  const handleSubmitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() && !formData.content.trim()) return;
    addNote({
      projectId: project.id,
      title: formData.title.trim(),
      content: formData.content,
      color: formData.color,
    });
    setShowAddForm(false);
    setFormData({ title: '', content: '', color: 'default' });
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
    setFormData({ title: '', content: '', color: 'default' });
  };

  const handleNoteDragStart = (noteId: string) => {
    dragNote.current = noteId;
  };

  const handleNoteDragOver = (e: React.DragEvent, noteId: string) => {
    e.preventDefault();
    dragOverNote.current = noteId;
  };

  const handleNoteDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!dragNote.current || !dragOverNote.current || dragNote.current === dragOverNote.current) {
      dragNote.current = null;
      dragOverNote.current = null;
      return;
    }
    const ids = projectNotes.map(n => n.id);
    const fromIdx = ids.indexOf(dragNote.current);
    const toIdx = ids.indexOf(dragOverNote.current);
    if (fromIdx === -1 || toIdx === -1) return;
    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, dragNote.current);
    reorderNotes(project.id, ids);
    dragNote.current = null;
    dragOverNote.current = null;
  };

  const handleDeleteNote = (noteId: string) => {
    if (confirm('이 노트를 삭제하시겠습니까?')) {
      deleteNote(noteId);
    }
  };

  const renderNoteCard = (note: NoteItem) => {
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
        onDragStart={() => handleNoteDragStart(note.id)}
        onDragOver={e => handleNoteDragOver(e, note.id)}
        onDrop={e => handleNoteDrop(e)}
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

  return (
    <div className="project-notes-tab">
      <div className="project-notes-header">
        <h3>프로젝트 노트</h3>
        <div className="project-notes-actions">
          <label className="notes-hide-toggle">
            <input type="checkbox" checked={showHidden} onChange={e => setShowHidden(e.target.checked)} />
            숨긴 노트 보기
          </label>
          <button className="btn btn-sm btn-primary" onClick={openAddForm}>+ 노트 추가</button>
        </div>
      </div>

      <div className="notes-grid">
        {showAddForm && (
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
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setShowAddForm(false)}>취소</button>
              </div>
            </form>
          </div>
        )}
        {projectNotes.map(note => renderNoteCard(note))}
        {!projectNotes.length && !showAddForm && (
          <div className="notes-empty-hint">노트가 없습니다. + 노트 추가 버튼을 클릭하세요.</div>
        )}
      </div>
    </div>
  );
}
