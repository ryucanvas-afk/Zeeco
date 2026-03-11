import { useState, useRef, useCallback, useEffect, type DragEvent } from 'react';
import type { Project, MasterScheduleTask } from '../types';
import { useProjects } from '../context/ProjectContext';
import EditableCell from './EditableCell';
import SchedulePdfPreview from './SchedulePdfPreview';
import { differenceInDays, parseISO, isValid, addDays, format, startOfMonth, endOfMonth, eachMonthOfInterval } from 'date-fns';

interface ScheduleTabProps {
  project: Project;
}

const GROUP_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6366f1',
  '#ec4899', '#14b8a6', '#f97316', '#8b5cf6', '#06b6d4',
];

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function computeDuration(start: string, end: string): number {
  const s = parseISO(start);
  const e = parseISO(end);
  if (!isValid(s) || !isValid(e)) return 0;
  return Math.max(differenceInDays(e, s), 0);
}

export default function ScheduleTab({ project }: ScheduleTabProps) {
  const { initializeDefaultSchedule, addMasterTask, updateMasterTask, deleteMasterTask, saveScheduleSnapshot, loadScheduleSnapshot, deleteScheduleSnapshot } = useProjects();
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<'group' | 'task'>('group');
  const [formParentId, setFormParentId] = useState('');
  const [formData, setFormData] = useState({ name: '', startDate: '', endDate: '', color: GROUP_COLORS[0] });
  const [inlineAddParentId, setInlineAddParentId] = useState<string | null>(null);
  const [inlineAddName, setInlineAddName] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [snapshotName, setSnapshotName] = useState('');
  const [showGantt, setShowGantt] = useState(false);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<'above' | 'below' | null>(null);
  const ganttRef = useRef<HTMLDivElement>(null);

  const tasks = project.masterSchedule || [];

  // Initialize default schedule groups if empty
  useEffect(() => {
    if (tasks.length === 0) {
      initializeDefaultSchedule(project.id);
    }
  }, [project.id, tasks.length, initializeDefaultSchedule]);

  // Build tree structure
  const rootTasks = tasks.filter(t => !t.parentId).sort((a, b) => a.sortOrder - b.sortOrder);
  const getChildren = useCallback((parentId: string) => {
    return tasks.filter(t => t.parentId === parentId).sort((a, b) => a.sortOrder - b.sortOrder);
  }, [tasks]);

  const hasChildren = useCallback((taskId: string) => {
    return tasks.some(t => t.parentId === taskId);
  }, [tasks]);

  // Initialize expanded groups
  useState(() => {
    const groups = new Set<string>();
    tasks.forEach(t => { if (!t.parentId || hasChildren(t.id)) groups.add(t.id); });
    setExpandedGroups(groups);
  });

  // Timeline calculation (for Gantt view)
  const allTasks = tasks.filter(t => t.startDate && t.endDate);
  const timelineStart = allTasks.length > 0
    ? allTasks.reduce((min, t) => {
      const d = parseISO(t.startDate);
      return isValid(d) && d < min ? d : min;
    }, parseISO(allTasks[0].startDate))
    : new Date();

  const timelineEnd = allTasks.length > 0
    ? allTasks.reduce((max, t) => {
      const d = parseISO(t.endDate);
      return isValid(d) && d > max ? d : max;
    }, parseISO(allTasks[0].endDate))
    : addDays(new Date(), 365);

  const paddedStart = isValid(timelineStart) ? startOfMonth(timelineStart) : startOfMonth(new Date());
  const paddedEnd = isValid(timelineEnd) ? endOfMonth(timelineEnd) : endOfMonth(addDays(new Date(), 365));
  const totalDays = Math.max(differenceInDays(paddedEnd, paddedStart), 1);

  // Month headers
  const months = isValid(paddedStart) && isValid(paddedEnd)
    ? eachMonthOfInterval({ start: paddedStart, end: paddedEnd })
    : [];

  // Today marker
  const today = new Date();
  const todayOffset = differenceInDays(today, paddedStart);
  const todayPercent = (todayOffset / totalDays) * 100;
  const showTodayLine = todayPercent >= 0 && todayPercent <= 100;

  const toggleExpand = (taskId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const expandAll = () => {
    const all = new Set<string>();
    tasks.forEach(t => { if (hasChildren(t.id) || !t.parentId) all.add(t.id); });
    setExpandedGroups(all);
  };

  const collapseAll = () => {
    setExpandedGroups(new Set());
  };

  const handleAddGroup = () => {
    setFormType('group');
    setFormParentId('');
    setFormData({ name: '', startDate: getToday(), endDate: '', color: GROUP_COLORS[rootTasks.length % GROUP_COLORS.length] });
    setShowForm(true);
  };

  const handleAddTask = (parentId: string) => {
    setInlineAddParentId(parentId);
    setInlineAddName('');
    // Expand the parent so we can see the inline form
    setExpandedGroups(prev => new Set(prev).add(parentId));
  };

  const handleInlineAddSubmit = (parentId: string) => {
    if (!inlineAddName.trim()) return;
    const parent = tasks.find(t => t.id === parentId);
    const siblings = getChildren(parentId);
    const maxOrder = siblings.reduce((max, t) => Math.max(max, t.sortOrder), -1);
    const newStart = parent?.startDate || getToday();
    const newEnd = parent?.endDate || '';
    addMasterTask(project.id, {
      parentId,
      name: inlineAddName.trim(),
      startDate: newStart,
      endDate: newEnd,
      duration: computeDuration(newStart, newEnd),
      progress: 0,
      color: parent?.color || GROUP_COLORS[0],
      expanded: true,
      sortOrder: maxOrder + 1,
      note: '',
    });
    setInlineAddName('');
    // Keep inline form open for quick consecutive adds
  };

  const handleInlineAddKeyDown = (e: React.KeyboardEvent, parentId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleInlineAddSubmit(parentId);
    } else if (e.key === 'Escape') {
      setInlineAddParentId(null);
      setInlineAddName('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const siblings = formParentId ? getChildren(formParentId) : rootTasks;
    const maxOrder = siblings.reduce((max, t) => Math.max(max, t.sortOrder), -1);
    addMasterTask(project.id, {
      parentId: formParentId,
      name: formData.name,
      startDate: formData.startDate,
      endDate: formData.endDate,
      duration: computeDuration(formData.startDate, formData.endDate),
      progress: 0,
      color: formData.color,
      expanded: true,
      sortOrder: maxOrder + 1,
      note: '',
    });
    setShowForm(false);
    if (formParentId) {
      setExpandedGroups(prev => new Set(prev).add(formParentId));
    }
  };

  // Propagate date changes upward: recalculate all ancestors' dates from their descendants
  const propagateParentDates = useCallback((childId: string, currentTasks: MasterScheduleTask[]) => {
    const taskMap = new Map(currentTasks.map(t => [t.id, t]));
    const getKids = (pid: string) => currentTasks.filter(t => t.parentId === pid);

    const computeRange = (parentId: string): { start: string; end: string } => {
      let minDate = '';
      let maxDate = '';
      const walk = (pid: string) => {
        const kids = getKids(pid);
        kids.forEach(c => {
          if (c.startDate && (!minDate || c.startDate < minDate)) minDate = c.startDate;
          if (c.endDate && (!maxDate || c.endDate > maxDate)) maxDate = c.endDate;
          if (getKids(c.id).length > 0) walk(c.id);
        });
      };
      walk(parentId);
      return { start: minDate, end: maxDate };
    };

    let current = taskMap.get(childId);
    if (!current) return;
    let parentId = current.parentId;
    while (parentId) {
      const range = computeRange(parentId);
      if (range.start || range.end) {
        const dur = (range.start && range.end) ? computeDuration(range.start, range.end) : 0;
        updateMasterTask(project.id, parentId, {
          startDate: range.start,
          endDate: range.end,
          duration: dur,
        });
      }
      const parent = taskMap.get(parentId);
      parentId = parent?.parentId || '';
    }
  }, [project.id, updateMasterTask]);

  const handleUpdate = (taskId: string, field: string, value: string | number) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const updates: Partial<MasterScheduleTask> = { [field]: value };
    if (field === 'startDate' || field === 'endDate') {
      const start = field === 'startDate' ? String(value) : task.startDate;
      const end = field === 'endDate' ? String(value) : task.endDate;
      updates.duration = computeDuration(start, end);
    }
    updateMasterTask(project.id, taskId, updates);

    // If date changed and this task has a parent, propagate upward
    if ((field === 'startDate' || field === 'endDate') && task.parentId) {
      // Build updated tasks array with the change applied
      const updatedTasks = tasks.map(t => t.id === taskId ? { ...t, ...updates } : t);
      propagateParentDates(taskId, updatedTasks);
    }
  };

  const handleDelete = (taskId: string) => {
    deleteMasterTask(project.id, taskId);
  };

  // Drag and drop handlers
  const handleDragStart = (e: DragEvent<HTMLDivElement>, taskId: string) => {
    setDragTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
    // Make the drag image slightly transparent
    if (e.currentTarget) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleDragEnd = (e: DragEvent<HTMLDivElement>) => {
    e.currentTarget.style.opacity = '1';
    setDragTaskId(null);
    setDragOverTaskId(null);
    setDragOverPosition(null);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>, taskId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (!dragTaskId || dragTaskId === taskId) return;

    const dragTask = tasks.find(t => t.id === dragTaskId);
    const overTask = tasks.find(t => t.id === taskId);
    if (!dragTask || !overTask) return;

    // Only allow reordering within the same parent
    if (dragTask.parentId !== overTask.parentId) return;

    // Determine above/below based on mouse position
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position = e.clientY < midY ? 'above' : 'below';

    setDragOverTaskId(taskId);
    setDragOverPosition(position);
  };

  const handleDragLeave = () => {
    setDragOverTaskId(null);
    setDragOverPosition(null);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>, targetTaskId: string) => {
    e.preventDefault();
    if (!dragTaskId || dragTaskId === targetTaskId) return;

    const dragTask = tasks.find(t => t.id === dragTaskId);
    const targetTask = tasks.find(t => t.id === targetTaskId);
    if (!dragTask || !targetTask) return;

    // Only reorder within the same parent
    if (dragTask.parentId !== targetTask.parentId) return;

    const parentId = dragTask.parentId;
    const siblings = parentId ? getChildren(parentId) : rootTasks;
    const orderedIds = siblings.map(t => t.id);

    // Remove dragged item from list
    const fromIndex = orderedIds.indexOf(dragTaskId);
    if (fromIndex === -1) return;
    orderedIds.splice(fromIndex, 1);

    // Insert at the target position
    let toIndex = orderedIds.indexOf(targetTaskId);
    if (toIndex === -1) return;
    if (dragOverPosition === 'below') toIndex++;
    orderedIds.splice(toIndex, 0, dragTaskId);

    // Update sortOrder for all siblings
    orderedIds.forEach((id, idx) => {
      updateMasterTask(project.id, id, { sortOrder: idx });
    });

    setDragTaskId(null);
    setDragOverTaskId(null);
    setDragOverPosition(null);
  };

  // Compute group progress from all descendants recursively
  const getGroupProgress = useCallback((taskId: string): number => {
    const children = getChildren(taskId);
    if (children.length === 0) return 0;
    let totalProgress = 0;
    let count = 0;
    children.forEach(c => {
      if (hasChildren(c.id)) {
        const childProgress = getGroupProgress(c.id);
        totalProgress += childProgress;
      } else {
        totalProgress += (c.progress || 0);
      }
      count++;
    });
    return count > 0 ? Math.round(totalProgress / count) : 0;
  }, [getChildren, hasChildren]);

  // Compute group date range from all descendants recursively
  const getGroupDateRange = useCallback((taskId: string): { start: string; end: string } => {
    const children = getChildren(taskId);
    if (children.length === 0) {
      const t = tasks.find(x => x.id === taskId);
      return { start: t?.startDate || '', end: t?.endDate || '' };
    }
    let minDate = '';
    let maxDate = '';
    const collectDates = (parentId: string) => {
      const kids = getChildren(parentId);
      kids.forEach(c => {
        if (c.startDate && (!minDate || c.startDate < minDate)) minDate = c.startDate;
        if (c.endDate && (!maxDate || c.endDate > maxDate)) maxDate = c.endDate;
        if (hasChildren(c.id)) collectDates(c.id);
      });
    };
    collectDates(taskId);
    return { start: minDate, end: maxDate };
  }, [tasks, getChildren, hasChildren]);

  const renderGanttBar = (task: MasterScheduleTask, isGroup: boolean) => {
    let start: string, end: string;
    if (isGroup) {
      const range = getGroupDateRange(task.id);
      start = range.start || task.startDate;
      end = range.end || task.endDate;
    } else {
      start = task.startDate;
      end = task.endDate;
    }

    const s = parseISO(start);
    const e = parseISO(end);
    if (!isValid(s) || !isValid(e)) return null;

    const left = (differenceInDays(s, paddedStart) / totalDays) * 100;
    const width = Math.max((differenceInDays(e, s) / totalDays) * 100, 0.5);
    const progress = isGroup ? getGroupProgress(task.id) : task.progress;
    const barColor = task.color || '#6366f1';

    return (
      <div className="ms-gantt-bar-area">
        {months.map((m, i) => {
          const mStart = differenceInDays(m, paddedStart);
          const mLeft = (mStart / totalDays) * 100;
          return <div key={i} className="ms-gantt-gridline" style={{ left: `${mLeft}%` }} />;
        })}
        {showTodayLine && <div className="ms-gantt-today" style={{ left: `${todayPercent}%` }} />}
        <div
          className={`ms-gantt-bar ${isGroup ? 'ms-gantt-bar-group' : ''}`}
          style={{
            left: `${Math.max(left, 0)}%`,
            width: `${width}%`,
            backgroundColor: barColor,
          }}
          title={`${task.name}: ${start} ~ ${end} (${progress}%)`}
        >
          {!isGroup && progress > 0 && (
            <div className="ms-gantt-bar-fill" style={{ width: `${progress}%` }} />
          )}
          {width > 3 && (
            <span className="ms-gantt-bar-label">{progress}%</span>
          )}
        </div>
      </div>
    );
  };

  // Get the depth level of a task (to determine if it's a group-like node)
  const isGroupNode = useCallback((task: MasterScheduleTask): boolean => {
    return hasChildren(task.id) || !task.parentId;
  }, [hasChildren]);

  const renderTaskRow = (task: MasterScheduleTask, level: number) => {
    const isExpanded = expandedGroups.has(task.id);
    const children = getChildren(task.id);
    const isGroup = isGroupNode(task);
    const groupProgress = isGroup ? getGroupProgress(task.id) : task.progress;

    const isDragOver = dragOverTaskId === task.id;
    const dragClass = isDragOver && dragOverPosition
      ? `ms-drag-${dragOverPosition}`
      : '';

    return (
      <div key={task.id}>
        <div
          className={`ms-row-wrapper ${isGroup ? 'ms-row-group' : 'ms-row-task'} ms-level-${Math.min(level, 4)} ${dragClass} ${dragTaskId === task.id ? 'ms-dragging' : ''}`}
          draggable
          onDragStart={e => handleDragStart(e, task.id)}
          onDragEnd={handleDragEnd}
          onDragOver={e => handleDragOver(e, task.id)}
          onDragLeave={handleDragLeave}
          onDrop={e => handleDrop(e, task.id)}
        >
          <div className="ms-row">
            <div className={`ms-row-info ${showGantt ? '' : 'ms-row-info-full'}`}>
              <div className="ms-row-name" style={{ paddingLeft: level * 24 }}>
                <span className="ms-drag-handle" title="드래그하여 순서 변경">⠿</span>
                {(isGroup || children.length > 0) && (
                  <button className="ms-expand-btn" onClick={() => toggleExpand(task.id)}>
                    {isExpanded ? '▼' : '▶'}
                  </button>
                )}
                {!isGroup && children.length === 0 && <span className="ms-task-dot" style={{ backgroundColor: task.color || '#6366f1' }} />}
                <EditableCell
                  value={task.name}
                  onSave={v => handleUpdate(task.id, 'name', v)}
                />
              </div>
              <div className="ms-row-dates">
                {isGroup && children.length > 0 ? (
                  <>
                    <span className="ms-computed-date" title="하위 항목 기준 자동 산정">{task.startDate || '-'}</span>
                    <span className="ms-date-sep">~</span>
                    <span className="ms-computed-date" title="하위 항목 기준 자동 산정">{task.endDate || '-'}</span>
                    <span className="ms-duration-computed" title="하위 항목 기준 자동 산정">{task.duration || 0}일</span>
                  </>
                ) : (
                  <>
                    <EditableCell
                      value={task.startDate}
                      type="date"
                      onSave={v => handleUpdate(task.id, 'startDate', v)}
                    />
                    <span className="ms-date-sep">~</span>
                    <EditableCell
                      value={task.endDate}
                      type="date"
                      onSave={v => handleUpdate(task.id, 'endDate', v)}
                    />
                    <input
                      className="ms-duration-input"
                      type="number"
                      min="0"
                      placeholder="일"
                      title="시작일 기준 기간(일) 입력시 종료일 자동 설정"
                      value={task.duration || ''}
                      onChange={e => {
                        const days = Number(e.target.value);
                        if (days >= 0 && task.startDate) {
                          const endDate = format(addDays(parseISO(task.startDate), days), 'yyyy-MM-dd');
                          updateMasterTask(project.id, task.id, {
                            duration: days,
                            endDate,
                          });
                          // Propagate to parents
                          if (task.parentId) {
                            const updatedTasks = tasks.map(t => t.id === task.id ? { ...t, endDate, duration: days } : t);
                            propagateParentDates(task.id, updatedTasks);
                          }
                        }
                      }}
                    />
                    <span className="ms-duration-label">일</span>
                  </>
                )}
              </div>
              <div className="ms-row-progress">
                {isGroup ? (
                  <span className="ms-progress-text">{groupProgress}%</span>
                ) : (
                  <EditableCell
                    value={String(task.progress)}
                    type="number"
                    onSave={v => handleUpdate(task.id, 'progress', Math.min(100, Math.max(0, Number(v))))}
                  />
                )}
                <div className="progress-bar-bg ms-progress-bar">
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: `${isGroup ? groupProgress : task.progress}%`,
                      backgroundColor: (isGroup ? groupProgress : task.progress) === 100 ? '#10b981' : task.color || '#6366f1',
                    }}
                  />
                </div>
              </div>
              <div className="ms-row-actions">
                <button className="btn-icon ms-btn-add" onClick={() => handleAddTask(task.id)} title="하위 작업 추가">+</button>
                <button className="btn-icon btn-danger ms-btn-del" onClick={() => handleDelete(task.id)} title="삭제">✕</button>
              </div>
            </div>
            {/* Right: Gantt bar (only shown when toggled) */}
            {showGantt && (
              <div className="ms-row-gantt">
                {renderGanttBar(task, isGroup)}
              </div>
            )}
          </div>
          {/* Note: full-width row below, separated by thin line */}
          <div className="ms-row-note-full">
            <EditableCell
              value={task.note || ''}
              type="multiline"
              placeholder="메모 입력..."
              onSave={v => handleUpdate(task.id, 'note', v)}
            />
          </div>
        </div>
        {/* Children (recursive) */}
        {isExpanded && children.map(child => renderTaskRow(child, level + 1))}
        {/* Inline add form */}
        {isExpanded && inlineAddParentId === task.id && (
          <div className="ms-row ms-row-inline-add" style={{ paddingLeft: (level + 1) * 24 + 12 }}>
            <div className="ms-inline-add-form">
              <span className="ms-task-dot" style={{ backgroundColor: task.color || '#6366f1' }} />
              <input
                type="text"
                className="ms-inline-add-input"
                placeholder="하위 작업명 입력 후 Enter (Esc: 취소)"
                value={inlineAddName}
                onChange={e => setInlineAddName(e.target.value)}
                onKeyDown={e => handleInlineAddKeyDown(e, task.id)}
                autoFocus
              />
              <button
                className="btn btn-primary btn-sm ms-inline-add-btn"
                onClick={() => handleInlineAddSubmit(task.id)}
                disabled={!inlineAddName.trim()}
              >
                추가
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => { setInlineAddParentId(null); setInlineAddName(''); }}
              >
                닫기
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="schedule-tab schedule-tab-fullscreen">
      {/* Master Schedule Header */}
      <div className="section-card ms-section-card">
        <div className="section-header">
          <h3 className="section-title">Master Schedule</h3>
          <div className="section-actions" style={{ gap: 6, display: 'flex', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary btn-sm" onClick={expandAll}>모두 펼치기</button>
            <button className="btn btn-secondary btn-sm" onClick={collapseAll}>모두 접기</button>
            <button
              className={`btn btn-sm ${showGantt ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setShowGantt(!showGantt)}
            >
              {showGantt ? '도표 숨기기' : '도표 보기'}
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleAddGroup}>+ 그룹 추가</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowSnapshots(!showSnapshots)}>
              CASE 관리 {(project.scheduleSnapshots || []).length > 0 ? `(${(project.scheduleSnapshots || []).length})` : ''}
            </button>
            <button className="btn btn-accent btn-sm" onClick={() => setShowPdfPreview(true)}>PDF 추출</button>
          </div>
        </div>

        {showForm && (
          <form className="inline-form" onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>{formType === 'group' ? '그룹명' : '작업명'}</label>
                <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required placeholder={formType === 'group' ? 'DOCUMENT APPROVAL' : 'Burner Spec Drawing'} />
              </div>
              <div className="form-group">
                <label>시작일</label>
                <input type="date" value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>종료일</label>
                <input type="date" value={formData.endDate} onChange={e => setFormData({ ...formData, endDate: e.target.value })} required />
              </div>
              {formType === 'group' && (
                <div className="form-group">
                  <label>색상</label>
                  <div className="ms-color-picker-row">
                    {GROUP_COLORS.map(c => (
                      <div
                        key={c}
                        className={`ms-color-swatch ${formData.color === c ? 'active' : ''}`}
                        style={{ backgroundColor: c }}
                        onClick={() => setFormData({ ...formData, color: c })}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">{formType === 'group' ? '그룹 추가' : '작업 추가'}</button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>취소</button>
            </div>
          </form>
        )}

        {/* CASE (Snapshot) Panel */}
        {showSnapshots && (
          <div className="ms-snapshot-panel">
            <div className="ms-snapshot-save">
              <input
                type="text"
                className="ms-snapshot-input"
                placeholder="CASE 이름 (예: Rev.A, 초기안, 2차 수정안)"
                value={snapshotName}
                onChange={e => setSnapshotName(e.target.value)}
              />
              <button
                className="btn btn-primary btn-sm"
                disabled={!snapshotName.trim() || tasks.length === 0}
                onClick={() => {
                  saveScheduleSnapshot(project.id, snapshotName.trim());
                  setSnapshotName('');
                }}
              >
                현재 일정 저장
              </button>
            </div>
            {(project.scheduleSnapshots || []).length > 0 ? (
              <div className="ms-snapshot-list">
                {(project.scheduleSnapshots || []).map(snap => (
                  <div key={snap.id} className="ms-snapshot-card">
                    <div className="ms-snapshot-card-info">
                      <strong>{snap.name}</strong>
                      <span className="ms-snapshot-date">
                        {new Date(snap.createdAt).toLocaleDateString('ko-KR')} {new Date(snap.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="ms-snapshot-count">{snap.tasks.length}개 작업</span>
                    </div>
                    <div className="ms-snapshot-card-actions">
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          if (confirm(`"${snap.name}" CASE를 불러오시겠습니까? 현재 일정이 대체됩니다.`)) {
                            loadScheduleSnapshot(project.id, snap.id);
                          }
                        }}
                      >
                        불러오기
                      </button>
                      <button
                        className="btn-icon btn-danger"
                        onClick={() => {
                          if (confirm(`"${snap.name}" CASE를 삭제하시겠습니까?`)) {
                            deleteScheduleSnapshot(project.id, snap.id);
                          }
                        }}
                        title="삭제"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="ms-snapshot-empty">저장된 CASE가 없습니다. 현재 일정을 저장하여 여러 버전을 관리하세요.</p>
            )}
          </div>
        )}

        {tasks.length > 0 && (
          <p className="edit-hint">셀을 클릭하면 직접 수정할 수 있습니다. 모든 항목에 하위 작업을 추가할 수 있습니다.</p>
        )}

        {/* Schedule Table */}
        <div className="ms-gantt-container" ref={ganttRef}>
          {/* Header */}
          <div className="ms-gantt-header">
            <div className={`ms-header-info ${showGantt ? '' : 'ms-header-info-full'}`}>
              <span className="ms-header-name">작업</span>
              <span className="ms-header-dates">기간</span>
              <span className="ms-header-progress">진행률</span>
              <span className="ms-header-act"></span>
            </div>
            {showGantt && (
              <div className="ms-header-timeline">
                {months.map((m, i) => {
                  const mStart = differenceInDays(m, paddedStart);
                  const mEnd = differenceInDays(endOfMonth(m), paddedStart);
                  const left = (mStart / totalDays) * 100;
                  const width = ((mEnd - mStart + 1) / totalDays) * 100;
                  return (
                    <div key={i} className="ms-month-header" style={{ left: `${left}%`, width: `${width}%` }}>
                      {format(m, 'yyyy-MM')}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Task rows */}
          <div className="ms-gantt-body">
            {rootTasks.map(task => renderTaskRow(task, 0))}
            {tasks.length === 0 && (
              <div className="ms-empty">
                <p>일정을 초기화하고 있습니다...</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PDF Preview Modal */}
      {showPdfPreview && (
        <SchedulePdfPreview
          project={project}
          expandedGroups={expandedGroups}
          onClose={() => setShowPdfPreview(false)}
        />
      )}
    </div>
  );
}
