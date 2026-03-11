import { useState, useRef, useCallback } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import type { Project, MasterScheduleTask } from '../types';
import { differenceInDays, parseISO, isValid, startOfMonth, endOfMonth, eachMonthOfInterval, format, addDays } from 'date-fns';

interface SchedulePdfPreviewProps {
  project: Project;
  expandedGroups: Set<string>;
  onClose: () => void;
}

type PaperSize = 'a4' | 'a3';

const PAPER_LABELS: Record<PaperSize, string> = { a4: 'A4 가로', a3: 'A3 가로' };

export default function SchedulePdfPreview({ project, expandedGroups, onClose }: SchedulePdfPreviewProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [paperSize, setPaperSize] = useState<PaperSize>('a4');

  const tasks = project.masterSchedule || [];
  const rootTasks = tasks.filter(t => !t.parentId).sort((a, b) => a.sortOrder - b.sortOrder);

  const getChildren = useCallback((parentId: string) =>
    tasks.filter(t => t.parentId === parentId).sort((a, b) => a.sortOrder - b.sortOrder),
  [tasks]);

  const hasChildren = useCallback((taskId: string) => tasks.some(t => t.parentId === taskId), [tasks]);

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

  const months = isValid(paddedStart) && isValid(paddedEnd)
    ? eachMonthOfInterval({ start: paddedStart, end: paddedEnd })
    : [];

  const today = new Date();
  const todayOffset = differenceInDays(today, paddedStart);
  const todayPercent = (todayOffset / totalDays) * 100;

  const getGroupProgress = useCallback((taskId: string): number => {
    const children = getChildren(taskId);
    if (children.length === 0) return 0;
    let total = 0, count = 0;
    children.forEach(c => {
      if (hasChildren(c.id)) {
        total += getGroupProgress(c.id);
      } else {
        total += (c.progress || 0);
      }
      count++;
    });
    return count > 0 ? Math.round(total / count) : 0;
  }, [getChildren, hasChildren]);

  const getGroupDateRange = useCallback((taskId: string): { start: string; end: string } => {
    const children = getChildren(taskId);
    if (children.length === 0) {
      const t = tasks.find(x => x.id === taskId);
      return { start: t?.startDate || '', end: t?.endDate || '' };
    }
    let minDate = '', maxDate = '';
    const collectDates = (parentId: string) => {
      getChildren(parentId).forEach(c => {
        if (c.startDate && (!minDate || c.startDate < minDate)) minDate = c.startDate;
        if (c.endDate && (!maxDate || c.endDate > maxDate)) maxDate = c.endDate;
        if (hasChildren(c.id)) collectDates(c.id);
      });
    };
    collectDates(taskId);
    return { start: minDate, end: maxDate };
  }, [tasks, getChildren, hasChildren]);

  // Flatten tasks for rendering (recursive), respecting collapsed state
  const flatTasks: { task: MasterScheduleTask; level: number; isGroup: boolean }[] = [];
  const flatten = (parentId: string, level: number) => {
    const children = parentId ? getChildren(parentId) : rootTasks;
    children.forEach(t => {
      const isGroup = hasChildren(t.id) || (!t.parentId);
      flatTasks.push({ task: t, level, isGroup });
      // Only include children if this group is expanded
      if (expandedGroups.has(t.id)) {
        flatten(t.id, level + 1);
      }
    });
  };
  flatten('', 0);

  const handleExportPdf = async () => {
    if (!printRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: paperSize });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = canvas.width;
      const imgHeight = canvas.height;

      const ratio = pdfWidth / imgWidth;
      const scaledHeight = imgHeight * ratio;

      if (scaledHeight <= pdfHeight) {
        const w = imgWidth * ratio;
        const h = scaledHeight;
        const x = (pdfWidth - w) / 2;
        const y = 5;
        pdf.addImage(imgData, 'PNG', x, y, w, h);
      } else {
        const pageContentHeight = pdfHeight - 10;
        const sourcePageHeight = pageContentHeight / ratio;
        let yOffset = 0;
        let pageNum = 0;

        while (yOffset < imgHeight) {
          if (pageNum > 0) pdf.addPage();
          const sliceHeight = Math.min(sourcePageHeight, imgHeight - yOffset);

          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = imgWidth;
          pageCanvas.height = sliceHeight;
          const ctx = pageCanvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(canvas, 0, yOffset, imgWidth, sliceHeight, 0, 0, imgWidth, sliceHeight);
            const pageData = pageCanvas.toDataURL('image/png');
            const w = imgWidth * ratio;
            const h = sliceHeight * ratio;
            const x = (pdfWidth - w) / 2;
            pdf.addImage(pageData, 'PNG', x, 5, w, h);
          }

          yOffset += sliceHeight;
          pageNum++;
        }
      }

      pdf.save(`${project.name}_Master_Schedule_${paperSize.toUpperCase()}.pdf`);
    } finally {
      setExporting(false);
    }
  };

  const renderBar = (task: MasterScheduleTask, isGroup: boolean) => {
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
    const durationDays = differenceInDays(e, s);

    return (
      <>
        <div style={{ position: 'absolute', left: `${Math.max(left, 0)}%`, width: `${width}%`, height: isGroup ? 10 : 16, top: isGroup ? 9 : 6, borderRadius: isGroup ? 2 : 4, backgroundColor: task.color || '#6366f1', overflow: 'hidden', boxShadow: isGroup ? 'none' : '0 1px 2px rgba(0,0,0,0.1)' }}>
          {!isGroup && progress > 0 && (
            <div style={{ width: `${progress}%`, height: '100%', backgroundColor: 'rgba(255,255,255,0.35)' }} />
          )}
        </div>
        {/* Date labels on bar */}
        {width > 5 && !isGroup && (
          <div style={{ position: 'absolute', left: `${Math.max(left, 0)}%`, width: `${width}%`, top: 23, display: 'flex', justifyContent: 'space-between', padding: '0 2px', fontSize: 7, color: '#94a3b8', fontFamily: "'SF Mono', Consolas, Monaco, monospace" }}>
            <span>{format(s, 'MM-dd')}</span>
            <span>{durationDays}d</span>
            <span>{format(e, 'MM-dd')}</span>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="pdf-preview-overlay" onClick={onClose}>
      <div className="pdf-preview-modal" style={{ maxWidth: 1400, width: '95vw' }} onClick={e => e.stopPropagation()}>
        <div className="pdf-preview-header">
          <span className="pdf-preview-title">Master Schedule PDF 미리보기</span>
          <div className="pdf-preview-actions">
            <div className="ms-paper-selector">
              {(['a4', 'a3'] as PaperSize[]).map(size => (
                <button
                  key={size}
                  className={`btn btn-sm ${paperSize === size ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setPaperSize(size)}
                >
                  {PAPER_LABELS[size]}
                </button>
              ))}
            </div>
            <button className="btn btn-primary" onClick={handleExportPdf} disabled={exporting}>
              {exporting ? 'PDF 생성 중...' : `PDF 다운로드 (${paperSize.toUpperCase()})`}
            </button>
            <button className="btn btn-secondary" onClick={onClose}>닫기</button>
          </div>
        </div>

        <div className="pdf-preview-scroll">
          <div className="ms-pdf-page" ref={printRef}>
            {/* Page header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '3px solid #0f172a', paddingBottom: 10, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px' }}>{project.name}</div>
                <div style={{ fontSize: 13, color: '#475569', fontWeight: 500, marginTop: 2 }}>Master Schedule</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                {project.projectNo && <div style={{ fontSize: 12, color: '#475569', fontWeight: 600, fontFamily: "'SF Mono', Consolas, Monaco, monospace" }}>Project No. {project.projectNo}</div>}
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Rev. {format(new Date(), 'yyyy-MM-dd')}</div>
              </div>
            </div>

            {/* Gantt Table Header */}
            <div style={{ display: 'flex', fontSize: 11, borderBottom: '2px solid #1e293b', fontWeight: 700, color: '#1e293b', letterSpacing: '0.3px' }}>
              <div style={{ width: 260, minWidth: 260, padding: '6px 8px', borderRight: '1px solid #cbd5e1' }}>Task Name</div>
              <div style={{ width: 72, minWidth: 72, padding: '6px 4px', borderRight: '1px solid #cbd5e1', textAlign: 'center' }}>Start</div>
              <div style={{ width: 72, minWidth: 72, padding: '6px 4px', borderRight: '1px solid #cbd5e1', textAlign: 'center' }}>Finish</div>
              <div style={{ width: 36, minWidth: 36, padding: '6px 4px', borderRight: '1px solid #cbd5e1', textAlign: 'center' }}>%</div>
              <div style={{ width: 100, minWidth: 100, padding: '6px 4px', borderRight: '1px solid #cbd5e1', textAlign: 'center' }}>Note</div>
              <div style={{ flex: 1, position: 'relative', display: 'flex' }}>
                {months.map((m, i) => {
                  const mStart = differenceInDays(m, paddedStart);
                  const mEnd = differenceInDays(endOfMonth(m), paddedStart);
                  const left = (mStart / totalDays) * 100;
                  const width = ((mEnd - mStart + 1) / totalDays) * 100;
                  return (
                    <div key={i} style={{ position: 'absolute', left: `${left}%`, width: `${width}%`, textAlign: 'center', padding: '6px 0', borderLeft: '1px solid #e2e8f0', fontSize: 10, fontFamily: "'SF Mono', Consolas, Monaco, monospace", fontWeight: 600 }}>
                      {format(m, 'yy.MM')}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Rows */}
            {flatTasks.map(({ task, level, isGroup }, idx) => {
              const progress = isGroup ? getGroupProgress(task.id) : task.progress;
              return (
                <div key={task.id} style={{ display: 'flex', fontSize: 11, borderBottom: '1px solid #e2e8f0', backgroundColor: isGroup && level === 0 ? '#f1f5f9' : idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                  <div style={{ width: 260, minWidth: 260, padding: '5px 8px', paddingLeft: 8 + level * 18, borderRight: '1px solid #e2e8f0', fontWeight: isGroup ? 700 : 400, color: isGroup ? '#0f172a' : '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 5, fontSize: isGroup && level === 0 ? 12 : 11 }}>
                    {isGroup ? (
                      <>
                        <span style={{ color: task.color || '#6366f1', fontSize: 10 }}>■</span>
                        {hasChildren(task.id) && !expandedGroups.has(task.id) && (
                          <span style={{ fontSize: 8, color: '#94a3b8' }}>▶</span>
                        )}
                      </>
                    ) : (
                      <span style={{ color: task.color || '#6366f1', fontSize: 8 }}>●</span>
                    )}
                    {task.name}
                  </div>
                  <div style={{ width: 72, minWidth: 72, padding: '5px 4px', borderRight: '1px solid #e2e8f0', textAlign: 'center', color: '#475569', fontSize: 10, fontFamily: "'SF Mono', Consolas, Monaco, monospace" }}>
                    {task.startDate ? format(parseISO(task.startDate), 'yy-MM-dd') : ''}
                  </div>
                  <div style={{ width: 72, minWidth: 72, padding: '5px 4px', borderRight: '1px solid #e2e8f0', textAlign: 'center', color: '#475569', fontSize: 10, fontFamily: "'SF Mono', Consolas, Monaco, monospace" }}>
                    {task.endDate ? format(parseISO(task.endDate), 'yy-MM-dd') : ''}
                  </div>
                  <div style={{ width: 36, minWidth: 36, padding: '5px 4px', borderRight: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 700, color: progress === 100 ? '#059669' : '#334155', fontFamily: "'SF Mono', Consolas, Monaco, monospace" }}>
                    {progress}%
                  </div>
                  <div style={{ width: 100, minWidth: 100, padding: '5px 4px', borderRight: '1px solid #e2e8f0', color: '#64748b', fontSize: 9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {task.note || ''}
                  </div>
                  <div style={{ flex: 1, position: 'relative', minHeight: 32 }}>
                    {/* Grid lines */}
                    {months.map((m, i) => {
                      const mStart = differenceInDays(m, paddedStart);
                      const mLeft = (mStart / totalDays) * 100;
                      return <div key={i} style={{ position: 'absolute', left: `${mLeft}%`, top: 0, bottom: 0, width: 1, backgroundColor: '#f1f5f9' }} />;
                    })}
                    {todayPercent >= 0 && todayPercent <= 100 && (
                      <div style={{ position: 'absolute', left: `${todayPercent}%`, top: 0, bottom: 0, width: 1.5, backgroundColor: '#ef4444', zIndex: 2 }} />
                    )}
                    {renderBar(task, isGroup)}
                  </div>
                </div>
              );
            })}

            {/* Legend + Footer */}
            <div style={{ marginTop: 20, paddingTop: 10, borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, color: '#64748b' }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ color: '#6366f1', fontSize: 10 }}>■</span> Group Task</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ color: '#6366f1', fontSize: 8 }}>●</span> Sub Task</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 14, height: 2, backgroundColor: '#ef4444', display: 'inline-block', borderRadius: 1 }} />
                  Today ({format(new Date(), 'yyyy-MM-dd')})
                </span>
              </div>
              <div style={{ fontWeight: 500 }}>
                ZEECO Asia | {project.name} | {new Date().toLocaleDateString('ko-KR')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
