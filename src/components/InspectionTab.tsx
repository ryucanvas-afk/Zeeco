import { useState } from 'react';
import type { Project, InspectionEntry } from '../types';
import { useProjects } from '../context/ProjectContext';
import InspectionPdfPreview from './InspectionPdfPreview';

interface InspectionTabProps {
  project: Project;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function dateToStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isDateInRange(dateStr: string, startStr: string, endStr: string): boolean {
  if (!startStr) return false;
  if (!endStr) return dateStr === startStr;
  return dateStr >= startStr && dateStr <= endStr;
}

function getRangePosition(dateStr: string, startStr: string, endStr: string): 'single' | 'start' | 'middle' | 'end' | null {
  if (!startStr) return null;
  if (!endStr || startStr === endStr) {
    return dateStr === startStr ? 'single' : null;
  }
  if (dateStr === startStr) return 'start';
  if (dateStr === endStr) return 'end';
  if (dateStr > startStr && dateStr < endStr) return 'middle';
  return null;
}

const MONTH_NAMES = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

const RANGE_COLORS = [
  { bg: 'rgba(59, 130, 246, 0.18)', border: '#3b82f6' },
  { bg: 'rgba(16, 185, 129, 0.18)', border: '#10b981' },
  { bg: 'rgba(245, 158, 11, 0.18)', border: '#f59e0b' },
  { bg: 'rgba(99, 102, 241, 0.18)', border: '#6366f1' },
  { bg: 'rgba(236, 72, 153, 0.18)', border: '#ec4899' },
  { bg: 'rgba(20, 184, 166, 0.18)', border: '#14b8a6' },
];

export default function InspectionTab({ project }: InspectionTabProps) {
  const { addInspection, updateInspection, deleteInspection } = useProjects();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    date: '',
    endDate: '',
    items: [''],
    categories: [''],
    location: '',
    inspector: '',
    observer: '',
    notes: '',
  });
  const [showPdfPreview, setShowPdfPreview] = useState(false);

  const inspections = (project.inspections || []);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const prevMonth = () => {
    if (month === 0) { setYear(year - 1); setMonth(11); }
    else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(year + 1); setMonth(0); }
    else setMonth(month + 1);
  };

  const getDateStr = (day: number) => {
    const m = String(month + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
  };

  const getInspectionsForDay = (day: number): InspectionEntry[] => {
    const dateStr = getDateStr(day);
    return inspections.filter(ins => isDateInRange(dateStr, ins.date, ins.endDate || ins.date));
  };

  const handleDayClick = (day: number) => {
    const dateStr = getDateStr(day);
    setSelectedDate(dateStr);
    setShowForm(false);
    setEditingId(null);
  };

  const openAddForm = (dateStr?: string) => {
    setFormData({
      date: dateStr || selectedDate || '',
      endDate: '',
      items: [''],
      categories: [''],
      location: '',
      inspector: '',
      observer: '',
      notes: '',
    });
    setEditingId(null);
    setShowForm(true);
    if (dateStr) setSelectedDate(dateStr);
  };

  const openEditForm = (ins: InspectionEntry) => {
    setFormData({
      date: ins.date,
      endDate: ins.endDate || '',
      items: ins.items.length > 0 ? [...ins.items] : [''],
      categories: ins.categories.length > 0 ? [...ins.categories] : [''],
      location: ins.location,
      inspector: ins.inspector,
      observer: ins.observer,
      notes: ins.notes || '',
    });
    setEditingId(ins.id);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanItems = formData.items.filter(x => x.trim());
    const cleanCategories = formData.categories.filter(x => x.trim());
    const data = {
      date: formData.date,
      endDate: formData.endDate,
      items: cleanItems,
      categories: cleanCategories,
      location: formData.location,
      inspector: formData.inspector,
      observer: formData.observer,
      notes: formData.notes,
    };

    if (editingId) {
      updateInspection(project.id, editingId, data);
    } else {
      addInspection(project.id, data);
    }
    setShowForm(false);
    setEditingId(null);
  };

  const addItemField = () => setFormData({ ...formData, items: [...formData.items, ''] });
  const removeItemField = (idx: number) => setFormData({ ...formData, items: formData.items.filter((_, i) => i !== idx) });
  const updateItemField = (idx: number, val: string) => {
    const newItems = [...formData.items];
    newItems[idx] = val;
    setFormData({ ...formData, items: newItems });
  };

  const addCategoryField = () => setFormData({ ...formData, categories: [...formData.categories, ''] });
  const removeCategoryField = (idx: number) => setFormData({ ...formData, categories: formData.categories.filter((_, i) => i !== idx) });
  const updateCategoryField = (idx: number, val: string) => {
    const newCats = [...formData.categories];
    newCats[idx] = val;
    setFormData({ ...formData, categories: newCats });
  };

  const selectedInspections = selectedDate ? inspections.filter(ins => isDateInRange(selectedDate, ins.date, ins.endDate || ins.date)) : [];

  // Build calendar grid
  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  // Build rows of 7
  const calendarRows: (number | null)[][] = [];
  for (let i = 0; i < calendarDays.length; i += 7) {
    calendarRows.push(calendarDays.slice(i, i + 7));
  }
  // Pad last row
  const lastRow = calendarRows[calendarRows.length - 1];
  while (lastRow.length < 7) lastRow.push(null);

  const todayStr = dateToStr(today);

  // Assign colors to inspections for range visualization
  const insColorMap = new Map<string, number>();
  inspections.forEach((ins, idx) => {
    insColorMap.set(ins.id, idx % RANGE_COLORS.length);
  });

  const formatDateRange = (ins: InspectionEntry) => {
    if (!ins.endDate || ins.date === ins.endDate) return ins.date;
    return `${ins.date} ~ ${ins.endDate}`;
  };

  return (
    <div className="inspection-tab">
      {/* Calendar Navigation */}
      <div className="insp-calendar-nav">
        <button className="btn btn-secondary" onClick={prevMonth}>&lt;</button>
        <span className="insp-calendar-title">{year}년 {MONTH_NAMES[month]}</span>
        <button className="btn btn-secondary" onClick={nextMonth}>&gt;</button>
        <button className="btn btn-sm btn-primary" onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); }} style={{ marginLeft: 8 }}>오늘</button>
        <button className="btn btn-sm btn-secondary" onClick={() => setShowPdfPreview(true)} style={{ marginLeft: 'auto' }}>PDF 미리보기 / 추출</button>
      </div>

      {/* Side-by-side: Calendar + Detail Panel */}
      <div className="insp-layout">
        {/* Left: Calendar */}
        <div className="insp-layout-calendar">
          <div className="insp-calendar">
            <div className="insp-calendar-header">
              {['일', '월', '화', '수', '목', '금', '토'].map(d => (
                <div key={d} className={`insp-calendar-header-cell ${d === '일' ? 'sun' : ''} ${d === '토' ? 'sat' : ''}`}>{d}</div>
              ))}
            </div>
            <div className="insp-calendar-body">
              {calendarRows.map((row, rowIdx) => (
                <div key={rowIdx} className="insp-calendar-row">
                  {row.map((day, colIdx) => {
                    if (day === null) return <div key={`empty-${rowIdx}-${colIdx}`} className="insp-calendar-cell insp-calendar-cell-empty" />;
                    const dayInspections = getInspectionsForDay(day);
                    const dateStr = getDateStr(day);
                    const isToday = dateStr === todayStr;
                    const isSelected = dateStr === selectedDate;
                    const isSun = colIdx === 0;
                    const isSat = colIdx === 6;

                    return (
                      <div
                        key={day}
                        className={`insp-calendar-cell ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''} ${dayInspections.length > 0 ? 'has-data' : ''}`}
                        onClick={() => handleDayClick(day)}
                      >
                        <div className="insp-cell-header">
                          <span className={`insp-day-num ${isSun ? 'sun' : ''} ${isSat ? 'sat' : ''}`}>{day}</span>
                          {dayInspections.length === 0 && (
                            <button className="insp-add-btn" onClick={e => { e.stopPropagation(); openAddForm(dateStr); }} title="검사 추가">+</button>
                          )}
                        </div>
                        <div className="insp-cell-content">
                          {dayInspections.map(ins => {
                            const colorIdx = insColorMap.get(ins.id) || 0;
                            const colors = RANGE_COLORS[colorIdx];
                            const pos = getRangePosition(dateStr, ins.date, ins.endDate || ins.date);
                            const rangeClass = pos && pos !== 'single' ? `insp-range-${pos}` : '';

                            return (
                              <div
                                key={ins.id}
                                className={`insp-cell-entry ${rangeClass}`}
                                style={{
                                  background: colors.bg,
                                  borderLeftColor: colors.border,
                                }}
                                onClick={e => { e.stopPropagation(); setSelectedDate(dateStr); }}
                              >
                                <div className="insp-cell-items">
                                  {ins.items.map((item, i) => (
                                    <span key={i} className="insp-cell-tag">{item}</span>
                                  ))}
                                </div>
                                {ins.categories.length > 0 && ins.categories[0] && (
                                  <div className="insp-cell-cats">
                                    {ins.categories.map((cat, i) => (
                                      <span key={i} className="insp-cell-cat-tag">{cat}</span>
                                    ))}
                                  </div>
                                )}
                                {ins.location && <span className="insp-cell-location">{ins.location}</span>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Detail Panel */}
        <div className="insp-layout-detail">
          {selectedDate ? (
            <div className="insp-detail-panel">
              <div className="insp-detail-panel-header">
                <h3>{selectedDate} 검사 일정</h3>
                <button className="btn btn-sm btn-primary" onClick={() => openAddForm()}>+ 검사 추가</button>
              </div>

              {showForm && (
                <form className="insp-detail-form" onSubmit={handleSubmit}>
                  <div className="insp-form-grid">
                    <div className="form-group">
                      <label>시작일</label>
                      <input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} required />
                    </div>
                    <div className="form-group">
                      <label>종료일</label>
                      <input type="date" value={formData.endDate} onChange={e => setFormData({ ...formData, endDate: e.target.value })} min={formData.date} />
                    </div>
                    <div className="form-group">
                      <label>장소</label>
                      <input type="text" value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} placeholder="검사 장소" />
                    </div>
                    <div className="form-group">
                      <label>담당자</label>
                      <input type="text" value={formData.inspector} onChange={e => setFormData({ ...formData, inspector: e.target.value })} placeholder="담당자" />
                    </div>
                    <div className="form-group">
                      <label>참관 업체</label>
                      <input type="text" value={formData.observer} onChange={e => setFormData({ ...formData, observer: e.target.value })} placeholder="참관 업체" />
                    </div>
                  </div>

                  <div className="multi-input-section">
                    <label>검사 품목</label>
                    {formData.items.map((item, idx) => (
                      <div key={idx} className="multi-input-row">
                        <input type="text" value={item} onChange={e => updateItemField(idx, e.target.value)} placeholder={`품목 ${idx + 1}`} />
                        {formData.items.length > 1 && (
                          <button type="button" className="btn-icon btn-danger" onClick={() => removeItemField(idx)}>✕</button>
                        )}
                      </div>
                    ))}
                    <button type="button" className="btn btn-secondary btn-sm" onClick={addItemField}>+ 품목 추가</button>
                  </div>

                  <div className="multi-input-section">
                    <label>검사 항목</label>
                    {formData.categories.map((cat, idx) => (
                      <div key={idx} className="multi-input-row">
                        <input type="text" value={cat} onChange={e => updateCategoryField(idx, e.target.value)} placeholder={`항목 ${idx + 1}`} />
                        {formData.categories.length > 1 && (
                          <button type="button" className="btn-icon btn-danger" onClick={() => removeCategoryField(idx)}>✕</button>
                        )}
                      </div>
                    ))}
                    <button type="button" className="btn btn-secondary btn-sm" onClick={addCategoryField}>+ 항목 추가</button>
                  </div>

                  <div className="form-group" style={{ marginTop: 8 }}>
                    <label>비고</label>
                    <input type="text" value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="메모" />
                  </div>

                  <div className="form-actions" style={{ marginTop: 12 }}>
                    <button type="submit" className="btn btn-primary">{editingId ? '수정' : '추가'}</button>
                    <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>취소</button>
                  </div>
                </form>
              )}

              {selectedInspections.length > 0 ? (
                <div className="insp-detail-list">
                  {selectedInspections.map(ins => {
                    const colorIdx = insColorMap.get(ins.id) || 0;
                    const colors = RANGE_COLORS[colorIdx];
                    return (
                      <div key={ins.id} className="insp-detail-card" style={{ borderLeftColor: colors.border }}>
                        <div className="insp-detail-card-header">
                          <span className="insp-detail-date">{formatDateRange(ins)}</span>
                          <div className="action-btns">
                            <button className="btn-icon" onClick={() => openEditForm(ins)} title="수정">&#9998;</button>
                            <button className="btn-icon btn-danger" onClick={() => deleteInspection(project.id, ins.id)} title="삭제">✕</button>
                          </div>
                        </div>

                        <div className="insp-detail-section">
                          <label>검사 품목</label>
                          <div className="tag-list">
                            {ins.items.map((item, i) => <span key={i} className="tag">{item}</span>)}
                          </div>
                        </div>

                        <div className="insp-detail-section">
                          <label>검사 항목</label>
                          <div className="tag-list">
                            {ins.categories.map((cat, i) => <span key={i} className="tag tag-cat">{cat}</span>)}
                          </div>
                        </div>

                        <div className="insp-detail-info-grid">
                          <div className="insp-detail-info">
                            <label>장소</label>
                            <span>{ins.location || '-'}</span>
                          </div>
                          <div className="insp-detail-info">
                            <label>담당자</label>
                            <span>{ins.inspector || '-'}</span>
                          </div>
                          <div className="insp-detail-info">
                            <label>참관 업체</label>
                            <span>{ins.observer || '-'}</span>
                          </div>
                        </div>

                        {ins.notes && (
                          <div className="insp-detail-notes">
                            <label>비고</label>
                            <span>{ins.notes}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                !showForm && <p className="insp-detail-empty">이 날짜에 등록된 검사 일정이 없습니다.</p>
              )}
            </div>
          ) : (
            <div className="insp-detail-placeholder">
              <div className="insp-detail-placeholder-icon">&#128197;</div>
              <p>달력에서 날짜를 선택하면<br />검사 세부 내용이 여기에 표시됩니다.</p>
            </div>
          )}
        </div>
      </div>

      {showPdfPreview && (
        <InspectionPdfPreview
          project={project}
          year={year}
          month={month}
          onClose={() => setShowPdfPreview(false)}
        />
      )}
    </div>
  );
}
