import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '../context/ProjectContext';
import { ProjectStatusBadge } from '../components/StatusBadge';
import { PROJECT_COLORS } from '../data/sampleData';
import type { ProjectStatus } from '../types';

function formatNumber(n: number): string {
  return n.toLocaleString();
}

export default function ProjectList() {
  const { projects, addProject, deleteProject, toggleHideProject, reorderProjects } = useProjects();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState<ProjectStatus | 'all'>('all');
  const [showHidden, setShowHidden] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const dragOverRef = useRef<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    projectNo: '',
    description: '',
    headerNote: '',
    status: 'planning' as ProjectStatus,
    contractDate: '',
    komDate: '',
    deliveryDate: '',
    deliverySchedules: [] as { id: string; label: string; date: string }[],
    client: '',
    color: PROJECT_COLORS[0],
    hidden: false,
    budgetKRW: 0,
    budgetUSD: 0,
    exchangeRate: 1350,
    targetGM: 0,
    currentGM: 0,
    engineeringCost: 0,
    directCost: 0,
    contingency: 0,
    needsFactoryManagement: false,
    initialContractAmount: 0,
    updatedContractAmount: 0,
    contractAmountUSD: 0,
    budgetItems: [],
  });

  const visibleProjects = showHidden ? projects : projects.filter(p => !p.hidden);
  const filtered = filterStatus === 'all' ? visibleProjects : visibleProjects.filter(p => p.status === filterStatus);
  const hiddenCount = projects.filter(p => p.hidden).length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addProject(formData);
    setFormData({
      name: '', projectNo: '', description: '', headerNote: '', status: 'planning',
      contractDate: '', komDate: '', deliveryDate: '', deliverySchedules: [],
      client: '', color: PROJECT_COLORS[projects.length % PROJECT_COLORS.length],
      hidden: false, budgetKRW: 0, budgetUSD: 0, exchangeRate: 1350,
      targetGM: 0, currentGM: 0,
      engineeringCost: 0,
      directCost: 0, contingency: 0, needsFactoryManagement: false,
      initialContractAmount: 0, updatedContractAmount: 0, contractAmountUSD: 0, budgetItems: [],
    });
    setShowForm(false);
  };

  const handleDragStart = (projectId: string) => {
    setDragId(projectId);
  };

  const handleDragOver = (e: React.DragEvent, projectId: string) => {
    e.preventDefault();
    dragOverRef.current = projectId;
  };

  const handleDrop = () => {
    if (!dragId || !dragOverRef.current || dragId === dragOverRef.current) {
      setDragId(null);
      dragOverRef.current = null;
      return;
    }
    const ids = filtered.map(p => p.id);
    const fromIdx = ids.indexOf(dragId);
    const toIdx = ids.indexOf(dragOverRef.current);
    if (fromIdx === -1 || toIdx === -1) return;
    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, dragId);
    // Get full project list order (replace filtered portion)
    const filteredSet = new Set(filtered.map(p => p.id));
    const result: string[] = [];
    let inserted = false;
    for (const p of projects) {
      if (filteredSet.has(p.id)) {
        if (!inserted) {
          result.push(...ids);
          inserted = true;
        }
      } else {
        result.push(p.id);
      }
    }
    if (!inserted) result.push(...ids);
    reorderProjects(result);
    setDragId(null);
    dragOverRef.current = null;
  };

  return (
    <div className="project-list-page">
      <div className="page-header">
        <h2>프로젝트 목록</h2>
        <div className="page-actions">
          <div className="toggle-group">
            <button className={`toggle-btn ${filterStatus === 'all' ? 'active' : ''}`} onClick={() => setFilterStatus('all')}>전체</button>
            <button className={`toggle-btn ${filterStatus === 'planning' ? 'active' : ''}`} onClick={() => setFilterStatus('planning')}>계획</button>
            <button className={`toggle-btn ${filterStatus === 'in_progress' ? 'active' : ''}`} onClick={() => setFilterStatus('in_progress')}>진행</button>
            <button className={`toggle-btn ${filterStatus === 'completed' ? 'active' : ''}`} onClick={() => setFilterStatus('completed')}>완료</button>
            <button className={`toggle-btn ${filterStatus === 'on_hold' ? 'active' : ''}`} onClick={() => setFilterStatus('on_hold')}>보류</button>
          </div>
          {hiddenCount > 0 && (
            <button className="btn btn-secondary" onClick={() => setShowHidden(!showHidden)}>
              {showHidden ? '숨김 프로젝트 감추기' : `숨김 (${hiddenCount})`}
            </button>
          )}
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ 새 프로젝트</button>
        </div>
      </div>

      {showForm && (
        <div className="section-card">
          <form className="inline-form" onSubmit={handleSubmit}>
            <h3 className="section-title">새 프로젝트 등록</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>프로젝트명</label>
                <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>프로젝트 No.</label>
                <input type="text" value={formData.projectNo} onChange={e => setFormData({ ...formData, projectNo: e.target.value })} placeholder="ZE-2026-XXX" />
              </div>
              <div className="form-group">
                <label>고객사</label>
                <input type="text" value={formData.client} onChange={e => setFormData({ ...formData, client: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>계약일</label>
                <input type="date" value={formData.contractDate} onChange={e => setFormData({ ...formData, contractDate: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>KOM Date</label>
                <input type="date" value={formData.komDate} onChange={e => setFormData({ ...formData, komDate: e.target.value })} />
              </div>
              <div className="form-group">
                <label>납기일 (최초 호기)</label>
                <input type="date" value={formData.deliveryDate} onChange={e => setFormData({ ...formData, deliveryDate: e.target.value })} required />
              </div>
              <div className="form-group full-width">
                <label>설명</label>
                <input type="text" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="factory-check-label">
                  <input
                    type="checkbox"
                    checked={formData.needsFactoryManagement}
                    onChange={e => setFormData({ ...formData, needsFactoryManagement: e.target.checked })}
                  />
                  공장 관리 필요
                </label>
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">등록</button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>취소</button>
            </div>
          </form>
        </div>
      )}

      <div className="project-grid">
        {filtered.map(project => {
          const items = project.items.length;
          const done = project.items.filter(i => i.status === 'completed').length;
          const progress = items > 0 ? Math.round((done / items) * 100) : 0;
          const purchases = project.items.flatMap(i => i.purchases);
          const pendingPurchases = purchases.filter(p => p.status !== 'delivered' && p.status !== 'partial_delivered').length;
          const totalBudget = (project.budgetKRW || 0) + (project.budgetUSD || 0) * (project.exchangeRate || 1350);

          return (
            <div
              key={project.id}
              className={`project-card ${project.hidden ? 'project-card-hidden' : ''} ${dragId === project.id ? 'project-card-dragging' : ''}`}
              style={{ borderTop: `3px solid ${project.color || '#3b82f6'}` }}
              onClick={() => navigate(`/project/${project.id}`)}
              draggable
              onDragStart={(e) => { e.stopPropagation(); handleDragStart(project.id); }}
              onDragOver={(e) => handleDragOver(e, project.id)}
              onDrop={(e) => { e.preventDefault(); handleDrop(); }}
              onDragEnd={() => { setDragId(null); dragOverRef.current = null; }}
            >
              <div className="project-card-header">
                <div>
                  <h3>{project.name}</h3>
                  {project.projectNo && <span className="project-card-no">No. {project.projectNo}</span>}
                </div>
                <div className="project-card-actions" onClick={e => e.stopPropagation()}>
                  <button
                    className="btn-icon"
                    onClick={() => toggleHideProject(project.id)}
                    title={project.hidden ? '표시' : '숨김'}
                  >
                    {project.hidden ? '◉' : '◎'}
                  </button>
                  <button
                    className="btn-icon btn-danger"
                    onClick={() => deleteProject(project.id)}
                    title="삭제"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <p className="project-card-client">{project.client}</p>
              <p className="project-card-desc">{project.description}</p>
              <div className="project-card-meta">
                <ProjectStatusBadge status={project.status} />
                <span className="meta-text">
                  {project.contractDate || '-'} ~ {project.deliveryDate || '-'}
                </span>
              </div>
              {totalBudget > 0 && (
                <div className="project-card-budget">
                  예산: {formatNumber(Math.round(totalBudget))} 원
                  {project.targetGM > 0 && <span className="gm-badge">GM {project.targetGM}%</span>}
                </div>
              )}
              <div className="project-card-stats">
                <div className="stat">
                  <span className="stat-value">{items}</span>
                  <span className="stat-label">품목</span>
                </div>
                <div className="stat">
                  <span className="stat-value">{progress}%</span>
                  <span className="stat-label">진행률</span>
                </div>
                <div className="stat">
                  <span className="stat-value">{pendingPurchases}</span>
                  <span className="stat-label">미입고</span>
                </div>
              </div>
              <div className="progress-bar-bg" style={{ marginTop: '8px' }}>
                <div className="progress-bar-fill" style={{ width: `${progress}%`, backgroundColor: progress === 100 ? '#10b981' : project.color || '#3b82f6' }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
