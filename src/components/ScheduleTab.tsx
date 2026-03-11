import { useState, useRef, useCallback } from 'react';
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
  const { addMasterTask, updateMasterTask, deleteMasterTask } = useProjects();
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<'group' | 'task'>('group');
  const [formParentId, setFormParentId] = useState('');
  const [formData, setFormData] = useState({ name: '', startDate: '', endDate: '', color: GROUP_COLORS[0] });
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const ganttRef = useRef<HTMLDivElement>(null);

  const tasks = project.masterSchedule || [];

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
    rootTasks.forEach(t => groups.add(t.id));
    setExpandedGroups(groups);
  });

  // Timeline calculation
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
    tasks.forEach(t => { if (hasChildren(t.id)) all.add(t.id); });
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
    setFormType('task');
    setFormParentId(parentId);
    const parent = tasks.find(t => t.id === parentId);
    setFormData({
      name: '',
      startDate: parent?.startDate || getToday(),
      endDate: parent?.endDate || '',
      color: parent?.color || GROUP_COLORS[0],
    });
    setShowForm(true);
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
    });
    setShowForm(false);
    if (formParentId) {
      setExpandedGroups(prev => new Set(prev).add(formParentId));
    }
  };

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
  };

  const handleDelete = (taskId: string) => {
    deleteMasterTask(project.id, taskId);
  };

  // Compute group progress from children
  const getGroupProgress = (taskId: string): number => {
    const children = getChildren(taskId);
    if (children.length === 0) return 0;
    const total = children.reduce((sum, c) => sum + (c.progress || 0), 0);
    return Math.round(total / children.length);
  };

  // Compute group date range from children
  const getGroupDateRange = (taskId: string): { start: string; end: string } => {
    const children = getChildren(taskId);
    if (children.length === 0) {
      const t = tasks.find(x => x.id === taskId);
      return { start: t?.startDate || '', end: t?.endDate || '' };
    }
    let minDate = '';
    let maxDate = '';
    children.forEach(c => {
      if (c.startDate && (!minDate || c.startDate < minDate)) minDate = c.startDate;
      if (c.endDate && (!maxDate || c.endDate > maxDate)) maxDate = c.endDate;
    });
    return { start: minDate, end: maxDate };
  };

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
        {/* Month grid lines */}
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
            backgroundColor: isGroup ? barColor : barColor,
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

  const renderTaskRow = (task: MasterScheduleTask, level: number, isGroup: boolean) => {
    const isExpanded = expandedGroups.has(task.id);
    const children = getChildren(task.id);
    const groupProgress = isGroup ? getGroupProgress(task.id) : task.progress;

    return (
      <div key={task.id}>
        <div className={`ms-row ${isGroup ? 'ms-row-group' : 'ms-row-task'} ms-level-${Math.min(level, 3)}`}>
          {/* Left: Task info */}
          <div className="ms-row-info">
            <div className="ms-row-name" style={{ paddingLeft: level * 20 }}>
              {isGroup && (
                <button className="ms-expand-btn" onClick={() => toggleExpand(task.id)}>
                  {isExpanded ? '▼' : '▶'}
                </button>
              )}
              {!isGroup && <span className="ms-task-dot" style={{ backgroundColor: task.color || '#6366f1' }} />}
              <EditableCell
                value={task.name}
                onSave={v => handleUpdate(task.id, 'name', v)}
              />
            </div>
            <div className="ms-row-dates">
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
              {isGroup && (
                <button className="btn-icon ms-btn-add" onClick={() => handleAddTask(task.id)} title="하위 작업 추가">+</button>
              )}
              <button className="btn-icon btn-danger ms-btn-del" onClick={() => handleDelete(task.id)} title="삭제">✕</button>
            </div>
          </div>
          {/* Right: Gantt bar */}
          <div className="ms-row-gantt">
            {renderGanttBar(task, isGroup)}
          </div>
        </div>
        {/* Children */}
        {isGroup && isExpanded && children.map(child => {
          const childIsGroup = hasChildren(child.id);
          return renderTaskRow(child, level + 1, childIsGroup);
        })}
      </div>
    );
  };

  return (
    <div className="schedule-tab">
      {/* Master Schedule Header */}
      <div className="section-card">
        <div className="section-header">
          <h3 className="section-title">Master Schedule (Gantt Chart)</h3>
          <div className="section-actions" style={{ gap: 6, display: 'flex', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary btn-sm" onClick={expandAll}>모두 펼치기</button>
            <button className="btn btn-secondary btn-sm" onClick={collapseAll}>모두 접기</button>
            <button className="btn btn-primary btn-sm" onClick={handleAddGroup}>+ 그룹 추가</button>
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

        {tasks.length > 0 && (
          <p className="edit-hint">셀을 클릭하면 직접 수정할 수 있습니다. ▶/▼로 그룹을 펼치거나 접을 수 있습니다.</p>
        )}

        {/* Gantt Chart */}
        <div className="ms-gantt-container" ref={ganttRef}>
          {/* Timeline header */}
          <div className="ms-gantt-header">
            <div className="ms-header-info">
              <span className="ms-header-name">작업</span>
              <span className="ms-header-dates">기간</span>
              <span className="ms-header-progress">진행률</span>
              <span className="ms-header-act"></span>
            </div>
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
          </div>

          {/* Task rows */}
          <div className="ms-gantt-body">
            {rootTasks.map(task => {
              const isGroup = hasChildren(task.id);
              return renderTaskRow(task, 0, isGroup || !task.parentId);
            })}
            {tasks.length === 0 && (
              <div className="ms-empty">
                <p>등록된 일정이 없습니다. "그룹 추가" 버튼으로 일정을 구성하세요.</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  GanttProject(.gan) 파일처럼 그룹 &gt; 하위 작업 형태로 구성됩니다.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PDF Preview Modal */}
      {showPdfPreview && (
        <SchedulePdfPreview
          project={project}
          onClose={() => setShowPdfPreview(false)}
        />
      )}
    </div>
  );
}
