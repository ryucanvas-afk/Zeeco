import { useState, useMemo } from 'react';
import type { Project, InspectionEntry } from '../types';
import { useProjects } from '../context/ProjectContext';
import InspectionPdfPreview from './InspectionPdfPreview';
import { v4 as uuidv4 } from 'uuid';

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


function formatDateShort(dateStr: string) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  return `${parts[0]}.${parts[1]}.${parts[2]}`;
}

const MONTH_NAMES = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

const COLOR_PRESETS = [
  { bg: 'rgba(59, 130, 246, 0.18)', border: '#3b82f6', label: 'Blue' },
  { bg: 'rgba(16, 185, 129, 0.18)', border: '#10b981', label: 'Green' },
  { bg: 'rgba(245, 158, 11, 0.18)', border: '#f59e0b', label: 'Amber' },
  { bg: 'rgba(99, 102, 241, 0.18)', border: '#6366f1', label: 'Indigo' },
  { bg: 'rgba(236, 72, 153, 0.18)', border: '#ec4899', label: 'Pink' },
  { bg: 'rgba(20, 184, 166, 0.18)', border: '#14b8a6', label: 'Teal' },
  { bg: 'rgba(239, 68, 68, 0.18)', border: '#ef4444', label: 'Red' },
  { bg: 'rgba(139, 92, 246, 0.18)', border: '#8b5cf6', label: 'Violet' },
  { bg: 'rgba(249, 115, 22, 0.18)', border: '#f97316', label: 'Orange' },
  { bg: 'rgba(6, 182, 212, 0.18)', border: '#06b6d4', label: 'Cyan' },
];

function getInsColors(ins: InspectionEntry, fallbackIdx: number) {
  if (ins.color) {
    const preset = COLOR_PRESETS.find(c => c.border === ins.color);
    if (preset) return { bg: preset.bg, border: preset.border };
    return { bg: ins.color + '30', border: ins.color };
  }
  const c = COLOR_PRESETS[fallbackIdx % COLOR_PRESETS.length];
  return { bg: c.bg, border: c.border };
}

function formatInspSummary(ins: InspectionEntry): string {
  // Format: 날짜 : Unit X_검사항목 for 검사품목_장소_참관업체
  const date = ins.endDate && ins.endDate !== ins.date
    ? `${formatDateShort(ins.date)}~${formatDateShort(ins.endDate)}`
    : formatDateShort(ins.date);
  const unit = ins.unit ? `${ins.unit}_` : '';
  const cats = ins.categories.filter(c => c.trim()).join(', ');
  const items = ins.items.filter(i => i.trim()).join(', ');
  const location = ins.location || '';
  const observer = ins.observer || '';

  let result = date;
  result += ' : ';
  result += unit;
  if (cats) result += cats;
  if (items) result += ` for ${items}`;
  if (location) result += `_${location}`;
  if (observer) result += ` - ${observer}`;
  return result;
}

export default function InspectionTab({ project }: InspectionTabProps) {
  const { addInspection, updateInspection, deleteInspection, updateProject } = useProjects();
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
    unit: '',
    location: '',
    inspector: '',
    observer: '',
    notes: '',
    color: '',
  });
  const [showPdfPreview, setShowPdfPreview] = useState(false);

  // Clipboard for copy/paste
  const [clipboardIns, setClipboardIns] = useState<InspectionEntry | null>(null);

  // Drag state
  const [dragInsId, setDragInsId] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  // Filter states
  const [filterItem, setFilterItem] = useState('all');
  const [filterLocation, setFilterLocation] = useState('all');
  const [filterInspector, setFilterInspector] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterUnit, setFilterUnit] = useState('all');

  // Common notes
  const commonNotes = project.inspectionCommonNotes || [];
  const [newNoteText, setNewNoteText] = useState('');

  const inspections = (project.inspections || []);

  // Extract unique values for filters
  const uniqueItems = useMemo(() => {
    const set = new Set<string>();
    inspections.forEach(ins => ins.items.forEach(i => { if (i.trim()) set.add(i); }));
    return [...set].sort();
  }, [inspections]);

  const uniqueLocations = useMemo(() =>
    [...new Set(inspections.map(i => i.location).filter(Boolean))].sort(),
    [inspections]
  );

  const uniqueInspectors = useMemo(() =>
    [...new Set(inspections.map(i => i.inspector).filter(Boolean))].sort(),
    [inspections]
  );

  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    inspections.forEach(ins => ins.categories.forEach(c => { if (c.trim()) set.add(c); }));
    return [...set].sort();
  }, [inspections]);

  const uniqueUnits = useMemo(() =>
    [...new Set(inspections.map(i => i.unit).filter(Boolean))].sort(),
    [inspections]
  );

  const hasActiveFilters = filterItem !== 'all' || filterLocation !== 'all' || filterInspector !== 'all' || filterCategory !== 'all' || filterUnit !== 'all';

  // Filter inspections
  const filteredInspections = useMemo(() => {
    let result = inspections;
    if (filterItem !== 'all') result = result.filter(ins => ins.items.includes(filterItem));
    if (filterLocation !== 'all') result = result.filter(ins => ins.location === filterLocation);
    if (filterInspector !== 'all') result = result.filter(ins => ins.inspector === filterInspector);
    if (filterCategory !== 'all') result = result.filter(ins => ins.categories.includes(filterCategory));
    if (filterUnit !== 'all') result = result.filter(ins => ins.unit === filterUnit);
    return result;
  }, [inspections, filterItem, filterLocation, filterInspector, filterCategory, filterUnit]);

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
    return filteredInspections.filter(ins => isDateInRange(dateStr, ins.date, ins.endDate || ins.date));
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
      unit: '',
      location: '',
      inspector: '',
      observer: '',
      notes: '',
      color: '',
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
      unit: ins.unit || '',
      location: ins.location,
      inspector: ins.inspector,
      observer: ins.observer,
      notes: ins.notes || '',
      color: ins.color || '',
    });
    setEditingId(ins.id);
    setShowForm(true);
  };

  const handleCopy = (ins: InspectionEntry) => {
    setClipboardIns(ins);
  };

  const handlePaste = (targetDate: string) => {
    if (!clipboardIns) return;
    // Calculate duration offset
    const origStart = new Date(clipboardIns.date);
    const target = new Date(targetDate);
    const diffDays = Math.round((target.getTime() - origStart.getTime()) / (1000 * 60 * 60 * 24));

    let newEndDate = '';
    if (clipboardIns.endDate) {
      const origEnd = new Date(clipboardIns.endDate);
      const newEnd = new Date(origEnd.getTime() + diffDays * 24 * 60 * 60 * 1000);
      newEndDate = dateToStr(newEnd);
    }

    addInspection(project.id, {
      date: targetDate,
      endDate: newEndDate,
      items: [...clipboardIns.items],
      categories: [...clipboardIns.categories],
      unit: clipboardIns.unit || '',
      location: clipboardIns.location,
      inspector: clipboardIns.inspector,
      observer: clipboardIns.observer,
      notes: clipboardIns.notes || '',
      color: clipboardIns.color || '',
    });
  };

  const handleDragStart = (insId: string) => {
    setDragInsId(insId);
  };

  const handleDragOverCell = (e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    setDragOverDate(dateStr);
  };

  const handleDropOnCell = (targetDate: string) => {
    if (!dragInsId) return;
    const ins = inspections.find(i => i.id === dragInsId);
    if (!ins) return;

    // Calculate date offset
    const origStart = new Date(ins.date);
    const target = new Date(targetDate);
    const diffDays = Math.round((target.getTime() - origStart.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      setDragInsId(null);
      setDragOverDate(null);
      return;
    }

    // Shift both start and end dates by the diff
    const newStart = targetDate;
    let newEnd = '';
    if (ins.endDate) {
      const origEnd = new Date(ins.endDate);
      const shifted = new Date(origEnd.getTime() + diffDays * 24 * 60 * 60 * 1000);
      newEnd = dateToStr(shifted);
    }

    updateInspection(project.id, ins.id, { date: newStart, endDate: newEnd });
    setDragInsId(null);
    setDragOverDate(null);
  };

  const handleDragEnd = () => {
    setDragInsId(null);
    setDragOverDate(null);
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
      unit: formData.unit,
      location: formData.location,
      inspector: formData.inspector,
      observer: formData.observer,
      notes: formData.notes,
      color: formData.color,
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

  const selectedInspections = selectedDate ? filteredInspections.filter(ins => isDateInRange(selectedDate, ins.date, ins.endDate || ins.date)) : [];

  // Build calendar grid
  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  const calendarRows: (number | null)[][] = [];
  for (let i = 0; i < calendarDays.length; i += 7) {
    calendarRows.push(calendarDays.slice(i, i + 7));
  }
  const lastRow = calendarRows[calendarRows.length - 1];
  while (lastRow.length < 7) lastRow.push(null);

  const todayStr = dateToStr(today);

  // Build spanning event data per row
  interface SpanBar {
    ins: InspectionEntry;
    startCol: number;
    endCol: number;
    continuesLeft: boolean;
    continuesRight: boolean;
    lane: number;
  }

  const rowSpanData = useMemo(() => {
    return calendarRows.map((row) => {
      // Dates in this row
      const rowDates: (string | null)[] = row.map((day) =>
        day !== null ? getDateStr(day) : null
      );

      // Find all multi-day inspections that overlap with this row
      const multiDay: SpanBar[] = [];
      const singleDay = new Map<number, InspectionEntry[]>(); // colIdx -> inspections

      for (const ins of filteredInspections) {
        const insEnd = ins.endDate || ins.date;
        const isMulti = ins.endDate && ins.endDate !== ins.date;

        // Check if this inspection overlaps any day in this row
        let startCol = -1;
        let endCol = -1;
        for (let c = 0; c < 7; c++) {
          const d = rowDates[c];
          if (!d) continue;
          if (isDateInRange(d, ins.date, insEnd)) {
            if (startCol === -1) startCol = c;
            endCol = c;
          }
        }

        if (startCol === -1) continue; // not in this row

        if (isMulti) {
          // Does it continue from before this row?
          const firstRowDate = rowDates.find(d => d !== null) || '';
          const continuesLeft = ins.date < firstRowDate;
          // Does it continue after this row?
          const lastRowDate = [...rowDates].reverse().find(d => d !== null) || '';
          const continuesRight = insEnd > lastRowDate;

          multiDay.push({
            ins,
            startCol,
            endCol,
            continuesLeft,
            continuesRight,
            lane: 0, // assigned below
          });
        } else {
          // Single day
          if (!singleDay.has(startCol)) singleDay.set(startCol, []);
          singleDay.get(startCol)!.push(ins);
        }
      }

      // Assign lanes (greedy: sort by startCol, then by span desc)
      multiDay.sort((a, b) => a.startCol - b.startCol || (b.endCol - b.startCol) - (a.endCol - a.startCol));
      const laneOccupied: number[][] = []; // laneOccupied[lane] = array of occupied column ranges
      for (const bar of multiDay) {
        let placed2 = false;
        for (let l = 0; l < laneOccupied.length; l++) {
          let hasConflict = false;
          for (let ci = 0; ci < laneOccupied[l].length; ci += 2) {
            const oStart = laneOccupied[l][ci];
            const oEnd = laneOccupied[l][ci + 1];
            if (bar.startCol <= oEnd && bar.endCol >= oStart) {
              hasConflict = true;
              break;
            }
          }
          if (!hasConflict) {
            bar.lane = l;
            laneOccupied[l].push(bar.startCol, bar.endCol);
            placed2 = true;
            break;
          }
        }
        if (!placed2) {
          bar.lane = laneOccupied.length;
          laneOccupied.push([bar.startCol, bar.endCol]);
        }
      }

      return { multiDay, singleDay, laneCount: laneOccupied.length };
    });
  }, [calendarRows, filteredInspections, getDateStr]);

  const SPAN_BAR_HEIGHT = 22;
  const SPAN_BAR_GAP = 2;

  // Color index map for fallback
  const insIndexMap = new Map<string, number>();
  inspections.forEach((ins, idx) => { insIndexMap.set(ins.id, idx); });

  const formatDateRange = (ins: InspectionEntry) => {
    if (!ins.endDate || ins.date === ins.endDate) return ins.date;
    return `${ins.date} ~ ${ins.endDate}`;
  };

  const addCommonNote = () => {
    if (!newNoteText.trim()) return;
    const updated = [...commonNotes, { id: uuidv4(), text: newNoteText.trim() }];
    updateProject(project.id, { inspectionCommonNotes: updated } as Partial<Project>);
    setNewNoteText('');
  };

  const removeCommonNote = (noteId: string) => {
    const updated = commonNotes.filter(n => n.id !== noteId);
    updateProject(project.id, { inspectionCommonNotes: updated } as Partial<Project>);
  };

  const updateCommonNote = (noteId: string, text: string) => {
    const updated = commonNotes.map(n => n.id === noteId ? { ...n, text } : n);
    updateProject(project.id, { inspectionCommonNotes: updated } as Partial<Project>);
  };

  // Get inspections for current month for the summary bar
  const monthInspections = useMemo(() => {
    const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const monthEnd = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
    return filteredInspections.filter(ins => {
      const insEnd = ins.endDate || ins.date;
      return ins.date <= monthEnd && insEnd >= monthStart;
    });
  }, [filteredInspections, year, month, daysInMonth]);

  return (
    <div className="inspection-tab">
      {/* Calendar Navigation */}
      <div className="insp-calendar-nav">
        <button className="btn btn-secondary" onClick={prevMonth}>&lt;</button>
        <span className="insp-calendar-title">{year}년 {MONTH_NAMES[month]}</span>
        <button className="btn btn-secondary" onClick={nextMonth}>&gt;</button>
        <button className="btn btn-sm btn-primary" onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); }} style={{ marginLeft: 8 }}>오늘</button>
        {clipboardIns && (
          <span className="insp-clipboard-indicator" title={`복사됨: ${clipboardIns.items.join(', ')}`}>
            복사됨
          </span>
        )}
        <button className="btn btn-sm btn-secondary" onClick={() => setShowPdfPreview(true)} style={{ marginLeft: 'auto' }}>PDF 미리보기 / 추출</button>
      </div>

      {/* Filters */}
      <div className="insp-filters">
        <select value={filterItem} onChange={e => setFilterItem(e.target.value)} className="insp-filter-select">
          <option value="all">전체 품목</option>
          {uniqueItems.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
        <select value={filterLocation} onChange={e => setFilterLocation(e.target.value)} className="insp-filter-select">
          <option value="all">전체 장소</option>
          {uniqueLocations.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <select value={filterInspector} onChange={e => setFilterInspector(e.target.value)} className="insp-filter-select">
          <option value="all">전체 담당자</option>
          {uniqueInspectors.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="insp-filter-select">
          <option value="all">전체 항목</option>
          {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterUnit} onChange={e => setFilterUnit(e.target.value)} className="insp-filter-select">
          <option value="all">전체 Unit</option>
          {uniqueUnits.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        {hasActiveFilters && (
          <button className="btn btn-sm btn-ghost" onClick={() => { setFilterItem('all'); setFilterLocation('all'); setFilterInspector('all'); setFilterCategory('all'); setFilterUnit('all'); }}>
            필터 초기화
          </button>
        )}
        {hasActiveFilters && (
          <span className="insp-filter-count">{filteredInspections.length}건 / {inspections.length}건</span>
        )}
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
              {calendarRows.map((row, rowIdx) => {
                const { multiDay, singleDay, laneCount } = rowSpanData[rowIdx];
                const spanReservedHeight = laneCount > 0 ? laneCount * (SPAN_BAR_HEIGHT + SPAN_BAR_GAP) + 2 : 0;

                return (
                  <div key={rowIdx} className="insp-calendar-row" style={{ position: 'relative' }}>
                    {/* Spanning bars layer */}
                    {multiDay.length > 0 && (
                      <div className="insp-span-layer" style={{ height: spanReservedHeight }}>
                        {multiDay.map(bar => {
                          const { ins, startCol, endCol, continuesLeft, continuesRight, lane } = bar;
                          const fallbackIdx = insIndexMap.get(ins.id) || 0;
                          const colors = getInsColors(ins, fallbackIdx);
                          const leftPct = (startCol / 7) * 100;
                          const widthPct = ((endCol - startCol + 1) / 7) * 100;
                          const topPx = lane * (SPAN_BAR_HEIGHT + SPAN_BAR_GAP) + 1;

                          return (
                            <div
                              key={`${ins.id}-${rowIdx}`}
                              className="insp-span-bar"
                              style={{
                                left: `${leftPct}%`,
                                width: `${widthPct}%`,
                                top: topPx,
                                height: SPAN_BAR_HEIGHT,
                                background: colors.bg,
                                borderLeft: continuesLeft ? 'none' : `3px solid ${colors.border}`,
                                borderRadius: `${continuesLeft ? 0 : 4}px ${continuesRight ? 0 : 4}px ${continuesRight ? 0 : 4}px ${continuesLeft ? 0 : 4}px`,
                              }}
                              draggable
                              onDragStart={e => { e.stopPropagation(); handleDragStart(ins.id); }}
                              onDragEnd={handleDragEnd}
                              onClick={e => { e.stopPropagation(); setSelectedDate(ins.date); }}
                            >
                              <div className="insp-span-bar-content">
                                <span className="insp-span-bar-items">{ins.items.join(', ')}</span>
                                {ins.unit && <span className="insp-span-bar-unit">{ins.unit}</span>}
                                {ins.categories.length > 0 && ins.categories[0] && (
                                  <span className="insp-span-bar-cats">{ins.categories.join(', ')}</span>
                                )}
                                {ins.location && <span className="insp-span-bar-loc">{ins.location}</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Day cells */}
                    <div className="insp-calendar-row-cells">
                      {row.map((day, colIdx) => {
                        if (day === null) return <div key={`empty-${rowIdx}-${colIdx}`} className="insp-calendar-cell insp-calendar-cell-empty" />;
                        const dateStr = getDateStr(day);
                        const isToday = dateStr === todayStr;
                        const isSelected = dateStr === selectedDate;
                        const isSun = colIdx === 0;
                        const isSat = colIdx === 6;
                        const daySingle = singleDay.get(colIdx) || [];

                        return (
                          <div
                            key={day}
                            className={`insp-calendar-cell ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''} ${(daySingle.length > 0 || getInspectionsForDay(day).length > 0) ? 'has-data' : ''} ${dragOverDate === dateStr ? 'insp-drag-over' : ''}`}
                            onClick={() => handleDayClick(day)}
                            onDragOver={e => handleDragOverCell(e, dateStr)}
                            onDragLeave={() => setDragOverDate(null)}
                            onDrop={e => { e.preventDefault(); handleDropOnCell(dateStr); }}
                          >
                            <div className="insp-cell-header">
                              <span className={`insp-day-num ${isSun ? 'sun' : ''} ${isSat ? 'sat' : ''}`}>{day}</span>
                              <div className="insp-cell-actions">
                                {clipboardIns && (
                                  <button className="insp-paste-btn" onClick={e => { e.stopPropagation(); handlePaste(dateStr); }} title="붙여넣기">&#9112;</button>
                                )}
                                <button className="insp-add-btn" onClick={e => { e.stopPropagation(); openAddForm(dateStr); }} title="검사 추가">+</button>
                              </div>
                            </div>
                            <div className="insp-cell-content">
                              {daySingle.map(ins => {
                                const fallbackIdx = insIndexMap.get(ins.id) || 0;
                                const colors = getInsColors(ins, fallbackIdx);
                                return (
                                  <div
                                    key={ins.id}
                                    className="insp-cell-entry"
                                    style={{
                                      background: colors.bg,
                                      borderLeftColor: colors.border,
                                    }}
                                    draggable
                                    onDragStart={e => { e.stopPropagation(); handleDragStart(ins.id); }}
                                    onDragEnd={handleDragEnd}
                                    onClick={e => { e.stopPropagation(); setSelectedDate(dateStr); }}
                                  >
                                    <div className="insp-cell-items">
                                      {ins.items.map((item, i) => (
                                        <span key={i} className="insp-cell-tag">{item}</span>
                                      ))}
                                    </div>
                                    {ins.unit && <span className="insp-cell-unit">{ins.unit}</span>}
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
                  </div>
                );
              })}
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
                      <label>Unit</label>
                      <input type="text" value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })} placeholder="Unit 1" />
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

                  {/* Color Picker */}
                  <div className="form-group" style={{ marginTop: 8 }}>
                    <label>배경 색상</label>
                    <div className="insp-color-picker">
                      <div
                        className={`insp-color-swatch ${!formData.color ? 'active' : ''}`}
                        style={{ background: 'linear-gradient(135deg, #e5e7eb 50%, #f3f4f6 50%)' }}
                        onClick={() => setFormData({ ...formData, color: '' })}
                        title="자동"
                      />
                      {COLOR_PRESETS.map(c => (
                        <div
                          key={c.border}
                          className={`insp-color-swatch ${formData.color === c.border ? 'active' : ''}`}
                          style={{ background: c.border }}
                          onClick={() => setFormData({ ...formData, color: c.border })}
                          title={c.label}
                        />
                      ))}
                      <input
                        type="color"
                        value={formData.color || '#3b82f6'}
                        onChange={e => setFormData({ ...formData, color: e.target.value })}
                        className="insp-color-custom"
                        title="커스텀 색상"
                      />
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
                    const fallbackIdx = insIndexMap.get(ins.id) || 0;
                    const colors = getInsColors(ins, fallbackIdx);
                    return (
                      <div key={ins.id} className="insp-detail-card" style={{ borderLeftColor: colors.border }}>
                        <div className="insp-detail-card-header">
                          <span className="insp-detail-date">{formatDateRange(ins)}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <div className="insp-detail-color-dot" style={{ background: colors.border }} />
                            <div className="action-btns">
                              <button className="btn-icon" onClick={() => handleCopy(ins)} title="복사">&#128203;</button>
                              <button className="btn-icon" onClick={() => openEditForm(ins)} title="수정">&#9998;</button>
                              <button className="btn-icon btn-danger" onClick={() => deleteInspection(project.id, ins.id)} title="삭제">✕</button>
                            </div>
                          </div>
                        </div>

                        {ins.unit && (
                          <div className="insp-detail-section">
                            <label>Unit</label>
                            <span className="tag tag-unit">{ins.unit}</span>
                          </div>
                        )}

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

      {/* Inspection Summary List */}
      {monthInspections.length > 0 && (
        <div className="insp-summary-bar">
          {monthInspections
            .sort((a, b) => a.date.localeCompare(b.date))
            .map(ins => {
              const fallbackIdx = insIndexMap.get(ins.id) || 0;
              const colors = getInsColors(ins, fallbackIdx);
              return (
                <div key={ins.id} className="insp-summary-item" onClick={() => setSelectedDate(ins.date)} style={{ cursor: 'pointer' }}>
                  <span className="insp-summary-dot" style={{ background: colors.border }} />
                  <span>{formatInspSummary(ins)}</span>
                </div>
              );
            })}
        </div>
      )}

      {/* Common Notes Section */}
      <div className="insp-common-notes">
        <div className="insp-common-notes-header">
          <h4>공통 Notes</h4>
        </div>
        <div className="insp-common-notes-list">
          {commonNotes.map((note, idx) => (
            <div key={note.id} className="insp-common-note-item">
              <span className="insp-common-note-num">{idx + 1}.</span>
              <input
                type="text"
                value={note.text}
                onChange={e => updateCommonNote(note.id, e.target.value)}
                className="insp-common-note-input"
              />
              <button className="btn-icon btn-danger" onClick={() => removeCommonNote(note.id)} title="삭제">✕</button>
            </div>
          ))}
          <div className="insp-common-note-add">
            <input
              type="text"
              value={newNoteText}
              onChange={e => setNewNoteText(e.target.value)}
              placeholder="새 공통 note 입력..."
              className="insp-common-note-input"
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCommonNote(); } }}
            />
            <button className="btn btn-sm btn-primary" onClick={addCommonNote}>+ 추가</button>
          </div>
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
