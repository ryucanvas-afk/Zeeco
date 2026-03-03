import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '../context/ProjectContext';
import { ProjectStatusBadge } from '../components/StatusBadge';
import type { ProjectStatus } from '../types';

export default function ProjectList() {
  const { projects, addProject, deleteProject } = useProjects();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState<ProjectStatus | 'all'>('all');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'planning' as ProjectStatus,
    startDate: '',
    endDate: '',
    client: '',
  });

  const filtered = filterStatus === 'all' ? projects : projects.filter(p => p.status === filterStatus);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addProject(formData);
    setFormData({ name: '', description: '', status: 'planning', startDate: '', endDate: '', client: '' });
    setShowForm(false);
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
                <label>고객사</label>
                <input type="text" value={formData.client} onChange={e => setFormData({ ...formData, client: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>시작일</label>
                <input type="date" value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>종료일</label>
                <input type="date" value={formData.endDate} onChange={e => setFormData({ ...formData, endDate: e.target.value })} required />
              </div>
              <div className="form-group full-width">
                <label>설명</label>
                <input type="text" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
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
          const pendingPurchases = purchases.filter(p => p.status !== 'delivered' && p.status !== 'cancelled').length;

          return (
            <div key={project.id} className="project-card" onClick={() => navigate(`/project/${project.id}`)}>
              <div className="project-card-header">
                <h3>{project.name}</h3>
                <button
                  className="btn-icon btn-danger"
                  onClick={(e) => { e.stopPropagation(); deleteProject(project.id); }}
                  title="삭제"
                >
                  ✕
                </button>
              </div>
              <p className="project-card-client">{project.client}</p>
              <p className="project-card-desc">{project.description}</p>
              <div className="project-card-meta">
                <ProjectStatusBadge status={project.status} />
                <span className="meta-text">{project.startDate} ~ {project.endDate}</span>
              </div>
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
                <div className="progress-bar-fill" style={{ width: `${progress}%`, backgroundColor: progress === 100 ? '#10b981' : '#3b82f6' }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
