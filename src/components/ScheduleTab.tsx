import { useState } from 'react';
import type { Project, Schedule, ItemStatus } from '../types';
import { useProjects } from '../context/ProjectContext';
import { ItemStatusBadge } from './StatusBadge';
import { format, differenceInDays, parseISO, isValid } from 'date-fns';

interface ScheduleTabProps {
  project: Project;
}

const emptySchedule: Omit<Schedule, 'id' | 'itemId'> = {
  task: '',
  startDate: '',
  endDate: '',
  progress: 0,
  status: 'not_started',
  assignee: '',
  notes: '',
};

export default function ScheduleTab({ project }: ScheduleTabProps) {
  const { addSchedule, updateSchedule, deleteSchedule } = useProjects();
  const [selectedItemId, setSelectedItemId] = useState<string>(project.items[0]?.id || '');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(emptySchedule);
  const [editingId, setEditingId] = useState<string | null>(null);

  const selectedItem = project.items.find(i => i.id === selectedItemId);

  const allSchedules = project.items.flatMap(item =>
    item.schedules.map(s => ({ ...s, itemName: item.name, itemCategory: item.category }))
  );

  const timelineStart = allSchedules.length > 0
    ? allSchedules.reduce((min, s) => {
        const d = parseISO(s.startDate);
        return isValid(d) && d < min ? d : min;
      }, parseISO(allSchedules[0].startDate))
    : new Date();

  const timelineEnd = allSchedules.length > 0
    ? allSchedules.reduce((max, s) => {
        const d = parseISO(s.endDate);
        return isValid(d) && d > max ? d : max;
      }, parseISO(allSchedules[0].endDate))
    : new Date();

  const totalDays = Math.max(differenceInDays(timelineEnd, timelineStart), 1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId) return;
    if (editingId) {
      updateSchedule(project.id, selectedItemId, editingId, formData);
      setEditingId(null);
    } else {
      addSchedule(project.id, selectedItemId, formData);
    }
    setFormData(emptySchedule);
    setShowForm(false);
  };

  const handleEdit = (schedule: Schedule) => {
    setFormData({
      task: schedule.task,
      startDate: schedule.startDate,
      endDate: schedule.endDate,
      progress: schedule.progress,
      status: schedule.status,
      assignee: schedule.assignee,
      notes: schedule.notes,
    });
    setEditingId(schedule.id);
    setShowForm(true);
  };

  return (
    <div className="schedule-tab">
      {/* Gantt Chart Overview */}
      <div className="section-card">
        <h3 className="section-title">전체 일정 (Gantt Chart)</h3>
        <div className="gantt-chart">
          <div className="gantt-header">
            <div className="gantt-label-col">작업</div>
            <div className="gantt-bar-col">
              <span>{isValid(timelineStart) ? format(timelineStart, 'yyyy-MM') : ''}</span>
              <span>{isValid(timelineEnd) ? format(timelineEnd, 'yyyy-MM') : ''}</span>
            </div>
          </div>
          {allSchedules.map(schedule => {
            const start = parseISO(schedule.startDate);
            const end = parseISO(schedule.endDate);
            if (!isValid(start) || !isValid(end)) return null;
            const left = (differenceInDays(start, timelineStart) / totalDays) * 100;
            const width = Math.max((differenceInDays(end, start) / totalDays) * 100, 2);
            const barColor =
              schedule.status === 'completed' ? '#10b981' :
              schedule.status === 'delayed' ? '#ef4444' :
              schedule.status === 'in_progress' ? '#f59e0b' : '#6366f1';
            return (
              <div key={schedule.id} className="gantt-row">
                <div className="gantt-label-col">
                  <span className="gantt-item-name">{schedule.itemName}</span>
                  <span className="gantt-task-name">{schedule.task}</span>
                </div>
                <div className="gantt-bar-col">
                  <div
                    className="gantt-bar"
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      backgroundColor: barColor,
                    }}
                  >
                    <div
                      className="gantt-bar-progress"
                      style={{ width: `${schedule.progress}%`, backgroundColor: 'rgba(255,255,255,0.3)' }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Item selector + Detail table */}
      <div className="section-card">
        <div className="section-header">
          <h3 className="section-title">품목별 일정 상세</h3>
          <div className="section-actions">
            <select
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              className="item-select"
            >
              {project.items.map(item => (
                <option key={item.id} value={item.id}>{item.name} ({item.category})</option>
              ))}
            </select>
            <button className="btn btn-primary" onClick={() => { setShowForm(true); setEditingId(null); setFormData(emptySchedule); }}>
              + 일정 추가
            </button>
          </div>
        </div>

        {showForm && (
          <form className="inline-form" onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>작업명</label>
                <input type="text" value={formData.task} onChange={e => setFormData({ ...formData, task: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>시작일</label>
                <input type="date" value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>종료일</label>
                <input type="date" value={formData.endDate} onChange={e => setFormData({ ...formData, endDate: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>진행률 ({formData.progress}%)</label>
                <input type="range" min="0" max="100" value={formData.progress} onChange={e => setFormData({ ...formData, progress: Number(e.target.value) })} />
              </div>
              <div className="form-group">
                <label>상태</label>
                <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as ItemStatus })}>
                  <option value="not_started">미착수</option>
                  <option value="in_progress">진행 중</option>
                  <option value="completed">완료</option>
                  <option value="delayed">지연</option>
                </select>
              </div>
              <div className="form-group">
                <label>담당자</label>
                <input type="text" value={formData.assignee} onChange={e => setFormData({ ...formData, assignee: e.target.value })} />
              </div>
              <div className="form-group full-width">
                <label>비고</label>
                <input type="text" value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">{editingId ? '수정' : '추가'}</button>
              <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>취소</button>
            </div>
          </form>
        )}

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>작업</th>
                <th>시작일</th>
                <th>종료일</th>
                <th>진행률</th>
                <th>상태</th>
                <th>담당자</th>
                <th>비고</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {selectedItem?.schedules.map(schedule => (
                <tr key={schedule.id}>
                  <td className="td-bold">{schedule.task}</td>
                  <td>{schedule.startDate}</td>
                  <td>{schedule.endDate}</td>
                  <td>
                    <div className="progress-cell">
                      <div className="progress-bar-bg">
                        <div
                          className="progress-bar-fill"
                          style={{
                            width: `${schedule.progress}%`,
                            backgroundColor: schedule.progress === 100 ? '#10b981' : '#3b82f6',
                          }}
                        />
                      </div>
                      <span>{schedule.progress}%</span>
                    </div>
                  </td>
                  <td><ItemStatusBadge status={schedule.status} /></td>
                  <td>{schedule.assignee}</td>
                  <td className="td-notes">{schedule.notes}</td>
                  <td>
                    <div className="action-btns">
                      <button className="btn-icon" onClick={() => { setSelectedItemId(selectedItem.id); handleEdit(schedule); }} title="수정">✎</button>
                      <button className="btn-icon btn-danger" onClick={() => deleteSchedule(project.id, selectedItem.id, schedule.id)} title="삭제">✕</button>
                    </div>
                  </td>
                </tr>
              ))}
              {(!selectedItem || selectedItem.schedules.length === 0) && (
                <tr><td colSpan={8} className="empty-row">등록된 일정이 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
