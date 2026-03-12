import { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import type { Project, InspectionEntry } from '../types';

interface InspectionPdfPreviewProps {
  project: Project;
  year: number;
  month: number;
  onClose: () => void;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function isDateInRange(dateStr: string, startStr: string, endStr: string): boolean {
  if (!startStr) return false;
  if (!endStr) return dateStr === startStr;
  return dateStr >= startStr && dateStr <= endStr;
}


const MONTH_NAMES = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

const COLOR_PRESETS = [
  { bg: 'rgba(59, 130, 246, 0.18)', border: '#3b82f6', text: '#1e40af' },
  { bg: 'rgba(16, 185, 129, 0.18)', border: '#10b981', text: '#065f46' },
  { bg: 'rgba(245, 158, 11, 0.18)', border: '#f59e0b', text: '#92400e' },
  { bg: 'rgba(99, 102, 241, 0.18)', border: '#6366f1', text: '#3730a3' },
  { bg: 'rgba(236, 72, 153, 0.18)', border: '#ec4899', text: '#9d174d' },
  { bg: 'rgba(20, 184, 166, 0.18)', border: '#14b8a6', text: '#115e59' },
  { bg: 'rgba(239, 68, 68, 0.18)', border: '#ef4444', text: '#991b1b' },
  { bg: 'rgba(139, 92, 246, 0.18)', border: '#8b5cf6', text: '#5b21b6' },
  { bg: 'rgba(249, 115, 22, 0.18)', border: '#f97316', text: '#9a3412' },
  { bg: 'rgba(6, 182, 212, 0.18)', border: '#06b6d4', text: '#155e75' },
];

function getInsColors(ins: InspectionEntry, fallbackIdx: number) {
  if (ins.color) {
    const preset = COLOR_PRESETS.find(c => c.border === ins.color);
    if (preset) return preset;
    return { bg: ins.color + '30', border: ins.color, text: ins.color };
  }
  return COLOR_PRESETS[fallbackIdx % COLOR_PRESETS.length];
}

export default function InspectionPdfPreview({ project, year, month, onClose }: InspectionPdfPreviewProps) {
  const calendarRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [previewMonth, setPreviewMonth] = useState(month);
  const [previewYear, setPreviewYear] = useState(year);

  const inspections = project.inspections || [];
  const commonNotes = project.inspectionCommonNotes || [];

  const daysInMonth = getDaysInMonth(previewYear, previewMonth);
  const firstDay = getFirstDayOfMonth(previewYear, previewMonth);

  const getDateStr = (day: number) => {
    const m = String(previewMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${previewYear}-${m}-${d}`;
  };

  const getInspectionsForDay = (day: number): InspectionEntry[] => {
    const dateStr = getDateStr(day);
    return inspections.filter(ins => isDateInRange(dateStr, ins.date, ins.endDate || ins.date));
  };

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  const calendarRows: (number | null)[][] = [];
  for (let i = 0; i < calendarDays.length; i += 7) {
    calendarRows.push(calendarDays.slice(i, i + 7));
  }
  const lastRow = calendarRows[calendarRows.length - 1];
  while (lastRow.length < 7) lastRow.push(null);

  const insIndexMap = new Map<string, number>();
  inspections.forEach((ins, idx) => { insIndexMap.set(ins.id, idx); });

  const prevMonth = () => {
    if (previewMonth === 0) { setPreviewYear(previewYear - 1); setPreviewMonth(11); }
    else setPreviewMonth(previewMonth - 1);
  };
  const nextMonth = () => {
    if (previewMonth === 11) { setPreviewYear(previewYear + 1); setPreviewMonth(0); }
    else setPreviewMonth(previewMonth + 1);
  };

  const handleExportPdf = async () => {
    if (!calendarRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(calendarRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);

      const w = imgWidth * ratio;
      const h = imgHeight * ratio;
      const x = (pdfWidth - w) / 2;
      const y = (pdfHeight - h) / 2;

      pdf.addImage(imgData, 'PNG', x, y, w, h);
      pdf.save(`${project.name}_검사일정_${previewYear}년${previewMonth + 1}월.pdf`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="pdf-preview-overlay" onClick={onClose}>
      <div className="pdf-preview-modal" onClick={e => e.stopPropagation()}>
        <div className="pdf-preview-header">
          <div className="pdf-preview-nav">
            <button className="btn btn-secondary btn-sm" onClick={prevMonth}>&lt;</button>
            <span className="pdf-preview-title">{previewYear}년 {MONTH_NAMES[previewMonth]} 검사 일정</span>
            <button className="btn btn-secondary btn-sm" onClick={nextMonth}>&gt;</button>
          </div>
          <div className="pdf-preview-actions">
            <button
              className="btn btn-primary"
              onClick={handleExportPdf}
              disabled={exporting}
            >
              {exporting ? 'PDF 생성 중...' : 'PDF 다운로드'}
            </button>
            <button className="btn btn-secondary" onClick={onClose}>닫기</button>
          </div>
        </div>

        <div className="pdf-preview-scroll">
          <div className="pdf-calendar-page" ref={calendarRef}>
            <div className="pdf-page-header">
              <div className="pdf-page-title">{project.name}</div>
              <div className="pdf-page-subtitle">
                검사 일정 - {previewYear}년 {MONTH_NAMES[previewMonth]}
              </div>
              {project.projectNo && (
                <div className="pdf-page-projno">Project No. {project.projectNo}</div>
              )}
            </div>

            {/* Calendar + Notes side by side */}
            <div className="pdf-insp-body" style={{ display: 'flex', gap: 12 }}>
              {/* Calendar */}
              <div style={{ flex: commonNotes.length > 0 ? '1 1 75%' : '1 1 100%' }}>
                <table className="pdf-calendar-table">
                  <thead>
                    <tr>
                      {['일', '월', '화', '수', '목', '금', '토'].map(d => (
                        <th key={d} className={`pdf-cal-th ${d === '일' ? 'sun' : ''} ${d === '토' ? 'sat' : ''}`}>{d}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {calendarRows.map((row, rowIdx) => (
                      <tr key={rowIdx}>
                        {row.map((day, colIdx) => {
                          if (day === null) {
                            return <td key={`empty-${rowIdx}-${colIdx}`} className="pdf-cal-td pdf-cal-empty" />;
                          }
                          const dayInspections = getInspectionsForDay(day);
                          const isSun = colIdx === 0;
                          const isSat = colIdx === 6;

                          return (
                            <td key={day} className="pdf-cal-td">
                              <div className={`pdf-cal-day ${isSun ? 'sun' : ''} ${isSat ? 'sat' : ''}`}>{day}</div>
                              <div className="pdf-cal-entries">
                                {dayInspections.map(ins => {
                                  const fallbackIdx = insIndexMap.get(ins.id) || 0;
                                  const colors = getInsColors(ins, fallbackIdx);

                                  return (
                                    <div
                                      key={ins.id}
                                      className="pdf-cal-entry"
                                      style={{
                                        background: colors.bg,
                                        borderLeftColor: colors.border,
                                        color: colors.text,
                                      }}
                                    >
                                      {ins.items.map((item, i) => (
                                        <div key={i} className="pdf-entry-item">{item}</div>
                                      ))}
                                      {ins.categories.length > 0 && ins.categories[0] && (
                                        <div className="pdf-entry-cats">
                                          {ins.categories.join(', ')}
                                        </div>
                                      )}
                                      {ins.location && (
                                        <div className="pdf-entry-location">{ins.location}</div>
                                      )}
                                      {ins.inspector && (
                                        <div className="pdf-entry-inspector">{ins.inspector}</div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Common Notes - right side */}
              {commonNotes.length > 0 && (
                <div className="pdf-insp-notes" style={{ flex: '0 0 22%', minWidth: 160 }}>
                  <div className="pdf-insp-notes-title">Notes</div>
                  <div className="pdf-insp-notes-list">
                    {commonNotes.map((note, idx) => (
                      <div key={note.id} className="pdf-insp-note-item">
                        <span className="pdf-insp-note-num">{idx + 1}.</span>
                        <span className="pdf-insp-note-text">{note.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pdf-page-footer">
              <span>Generated on {new Date().toLocaleDateString('ko-KR')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
