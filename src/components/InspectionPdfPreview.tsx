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
  { bg: 'rgba(59, 130, 246, 0.18)', border: '#3b82f6', text: '#1e40af' },
  { bg: 'rgba(16, 185, 129, 0.18)', border: '#10b981', text: '#065f46' },
  { bg: 'rgba(245, 158, 11, 0.18)', border: '#f59e0b', text: '#92400e' },
  { bg: 'rgba(99, 102, 241, 0.18)', border: '#6366f1', text: '#3730a3' },
  { bg: 'rgba(236, 72, 153, 0.18)', border: '#ec4899', text: '#9d174d' },
  { bg: 'rgba(20, 184, 166, 0.18)', border: '#14b8a6', text: '#115e59' },
];

export default function InspectionPdfPreview({ project, year, month, onClose }: InspectionPdfPreviewProps) {
  const calendarRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [previewMonth, setPreviewMonth] = useState(month);
  const [previewYear, setPreviewYear] = useState(year);

  const inspections = project.inspections || [];

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

  // Color map
  const insColorMap = new Map<string, number>();
  inspections.forEach((ins, idx) => {
    insColorMap.set(ins.id, idx % RANGE_COLORS.length);
  });

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
      // A4 landscape
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
        {/* Modal Header */}
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

        {/* Printable Calendar Area */}
        <div className="pdf-preview-scroll">
          <div className="pdf-calendar-page" ref={calendarRef}>
            {/* Page Header */}
            <div className="pdf-page-header">
              <div className="pdf-page-title">{project.name}</div>
              <div className="pdf-page-subtitle">
                검사 일정 - {previewYear}년 {MONTH_NAMES[previewMonth]}
              </div>
              {project.projectNo && (
                <div className="pdf-page-projno">Project No. {project.projectNo}</div>
              )}
            </div>

            {/* Calendar */}
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
                      const dateStr = getDateStr(day);
                      const isSun = colIdx === 0;
                      const isSat = colIdx === 6;

                      return (
                        <td key={day} className="pdf-cal-td">
                          <div className={`pdf-cal-day ${isSun ? 'sun' : ''} ${isSat ? 'sat' : ''}`}>{day}</div>
                          <div className="pdf-cal-entries">
                            {dayInspections.map(ins => {
                              const colorIdx = insColorMap.get(ins.id) || 0;
                              const colors = RANGE_COLORS[colorIdx];
                              const pos = getRangePosition(dateStr, ins.date, ins.endDate || ins.date);
                              const rangeClass = pos && pos !== 'single' ? `pdf-range-${pos}` : '';

                              return (
                                <div
                                  key={ins.id}
                                  className={`pdf-cal-entry ${rangeClass}`}
                                  style={{
                                    background: colors.bg,
                                    borderLeftColor: pos === 'middle' || pos === 'end' ? 'transparent' : colors.border,
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

            {/* Footer */}
            <div className="pdf-page-footer">
              <span>Generated on {new Date().toLocaleDateString('ko-KR')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
