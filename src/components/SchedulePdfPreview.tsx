import { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import type { Project, MasterScheduleTask } from '../types';
import { differenceInDays, parseISO, isValid, startOfMonth, endOfMonth, eachMonthOfInterval, format, addDays } from 'date-fns';

interface SchedulePdfPreviewProps {
  project: Project;
  onClose: () => void;
}

export default function SchedulePdfPreview({ project, onClose }: SchedulePdfPreviewProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const tasks = project.masterSchedule || [];
  const rootTasks = tasks.filter(t => !t.parentId).sort((a, b) => a.sortOrder - b.sortOrder);

  const getChildren = (parentId: string) =>
    tasks.filter(t => t.parentId === parentId).sort((a, b) => a.sortOrder - b.sortOrder);

  const hasChildren = (taskId: string) => tasks.some(t => t.parentId === taskId);

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

  const getGroupProgress = (taskId: string): number => {
    const children = getChildren(taskId);
    if (children.length === 0) return 0;
    return Math.round(children.reduce((sum, c) => sum + (c.progress || 0), 0) / children.length);
  };

  const getGroupDateRange = (taskId: string): { start: string; end: string } => {
    const children = getChildren(taskId);
    if (children.length === 0) {
      const t = tasks.find(x => x.id === taskId);
      return { start: t?.startDate || '', end: t?.endDate || '' };
    }
    let minDate = '', maxDate = '';
    children.forEach(c => {
      if (c.startDate && (!minDate || c.startDate < minDate)) minDate = c.startDate;
      if (c.endDate && (!maxDate || c.endDate > maxDate)) maxDate = c.endDate;
    });
    return { start: minDate, end: maxDate };
  };

  // Flatten tasks for rendering
  const flatTasks: { task: MasterScheduleTask; level: number; isGroup: boolean }[] = [];
  const flatten = (parentId: string, level: number) => {
    const children = parentId ? getChildren(parentId) : rootTasks;
    children.forEach(t => {
      const isGroup = hasChildren(t.id) || (!t.parentId);
      flatTasks.push({ task: t, level, isGroup });
      if (isGroup) flatten(t.id, level + 1);
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
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = canvas.width;
      const imgHeight = canvas.height;

      // Check if we need multiple pages
      const ratio = pdfWidth / imgWidth;
      const scaledHeight = imgHeight * ratio;

      if (scaledHeight <= pdfHeight) {
        // Fits on one page
        const w = imgWidth * ratio;
        const h = scaledHeight;
        const x = (pdfWidth - w) / 2;
        const y = 5;
        pdf.addImage(imgData, 'PNG', x, y, w, h);
      } else {
        // Multiple pages needed
        const pageContentHeight = pdfHeight - 10;
        const sourcePageHeight = pageContentHeight / ratio;
        let yOffset = 0;
        let pageNum = 0;

        while (yOffset < imgHeight) {
          if (pageNum > 0) pdf.addPage();
          const sliceHeight = Math.min(sourcePageHeight, imgHeight - yOffset);

          // Create a canvas for this page slice
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

      pdf.save(`${project.name}_Master_Schedule.pdf`);
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

    return (
      <div style={{ position: 'absolute', left: `${Math.max(left, 0)}%`, width: `${width}%`, height: isGroup ? 10 : 14, top: isGroup ? 7 : 5, borderRadius: isGroup ? 2 : 4, backgroundColor: task.color || '#6366f1', overflow: 'hidden' }}>
        {!isGroup && progress > 0 && (
          <div style={{ width: `${progress}%`, height: '100%', backgroundColor: 'rgba(255,255,255,0.3)' }} />
        )}
      </div>
    );
  };

  return (
    <div className="pdf-preview-overlay" onClick={onClose}>
      <div className="pdf-preview-modal" style={{ maxWidth: 1400, width: '95vw' }} onClick={e => e.stopPropagation()}>
        <div className="pdf-preview-header">
          <span className="pdf-preview-title">Master Schedule PDF 미리보기</span>
          <div className="pdf-preview-actions">
            <button className="btn btn-primary" onClick={handleExportPdf} disabled={exporting}>
              {exporting ? 'PDF 생성 중...' : 'PDF 다운로드'}
            </button>
            <button className="btn btn-secondary" onClick={onClose}>닫기</button>
          </div>
        </div>

        <div className="pdf-preview-scroll">
          <div className="ms-pdf-page" ref={printRef}>
            {/* Page header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '2px solid #1e293b', paddingBottom: 8, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{project.name}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Master Schedule</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                {project.projectNo && <div style={{ fontSize: 11, color: '#64748b' }}>Project No. {project.projectNo}</div>}
                <div style={{ fontSize: 11, color: '#64748b' }}>Rev. {format(new Date(), 'yyyy-MM-dd')}</div>
              </div>
            </div>

            {/* Gantt Table */}
            <div style={{ display: 'flex', fontSize: 10, borderBottom: '2px solid #334155', fontWeight: 600, color: '#334155' }}>
              <div style={{ width: 260, minWidth: 260, padding: '4px 6px', borderRight: '1px solid #cbd5e1' }}>Task Name</div>
              <div style={{ width: 75, minWidth: 75, padding: '4px 4px', borderRight: '1px solid #cbd5e1', textAlign: 'center' }}>Start</div>
              <div style={{ width: 75, minWidth: 75, padding: '4px 4px', borderRight: '1px solid #cbd5e1', textAlign: 'center' }}>Finish</div>
              <div style={{ width: 35, minWidth: 35, padding: '4px 4px', borderRight: '1px solid #cbd5e1', textAlign: 'center' }}>%</div>
              <div style={{ flex: 1, position: 'relative', display: 'flex' }}>
                {months.map((m, i) => {
                  const mStart = differenceInDays(m, paddedStart);
                  const mEnd = differenceInDays(endOfMonth(m), paddedStart);
                  const left = (mStart / totalDays) * 100;
                  const width = ((mEnd - mStart + 1) / totalDays) * 100;
                  return (
                    <div key={i} style={{ position: 'absolute', left: `${left}%`, width: `${width}%`, textAlign: 'center', padding: '4px 0', borderLeft: '1px solid #e2e8f0', fontSize: 9 }}>
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
                <div key={task.id} style={{ display: 'flex', fontSize: 10, borderBottom: '1px solid #e2e8f0', backgroundColor: isGroup && level === 0 ? '#f8fafc' : idx % 2 === 0 ? '#ffffff' : '#fafbfc' }}>
                  <div style={{ width: 260, minWidth: 260, padding: '3px 6px', paddingLeft: 6 + level * 16, borderRight: '1px solid #e2e8f0', fontWeight: isGroup ? 700 : 400, color: isGroup ? '#1e293b' : '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {isGroup ? (
                      <span style={{ color: task.color || '#6366f1', fontSize: 8 }}>■</span>
                    ) : (
                      <span style={{ color: task.color || '#6366f1', fontSize: 6 }}>●</span>
                    )}
                    {task.name}
                  </div>
                  <div style={{ width: 75, minWidth: 75, padding: '3px 4px', borderRight: '1px solid #e2e8f0', textAlign: 'center', color: '#64748b', fontSize: 9 }}>
                    {task.startDate ? format(parseISO(task.startDate), 'yy-MM-dd') : ''}
                  </div>
                  <div style={{ width: 75, minWidth: 75, padding: '3px 4px', borderRight: '1px solid #e2e8f0', textAlign: 'center', color: '#64748b', fontSize: 9 }}>
                    {task.endDate ? format(parseISO(task.endDate), 'yy-MM-dd') : ''}
                  </div>
                  <div style={{ width: 35, minWidth: 35, padding: '3px 4px', borderRight: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 600, color: progress === 100 ? '#10b981' : '#475569' }}>
                    {progress}%
                  </div>
                  <div style={{ flex: 1, position: 'relative', minHeight: 24 }}>
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
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 9, color: '#94a3b8' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span>■ Group Task</span>
                <span>● Sub Task</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <span style={{ width: 12, height: 2, backgroundColor: '#ef4444', display: 'inline-block' }} />
                  Today ({format(new Date(), 'yyyy-MM-dd')})
                </span>
              </div>
              <div>
                Generated on {new Date().toLocaleDateString('ko-KR')} | ZEECO Asia | {project.name}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
