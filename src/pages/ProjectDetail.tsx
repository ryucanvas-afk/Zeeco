import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProjects } from '../context/ProjectContext';
import { ProjectStatusBadge, ItemStatusBadge } from '../components/StatusBadge';
import ScheduleTab from '../components/ScheduleTab';
import PurchaseTab from '../components/PurchaseTab';
import type { ItemStatus } from '../types';

type TabType = 'overview' | 'schedule' | 'purchase';

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { projects, addItem, deleteItem } = useProjects();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [showAddItem, setShowAddItem] = useState(false);
  const [itemForm, setItemForm] = useState({ name: '', category: '', status: 'not_started' as ItemStatus });

  const project = projects.find(p => p.id === id);

  if (!project) {
    return (
      <div className="not-found">
        <h2>프로젝트를 찾을 수 없습니다.</h2>
        <button className="btn btn-primary" onClick={() => navigate('/')}>대시보드로 이동</button>
      </div>
    );
  }

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    addItem(project.id, itemForm);
    setItemForm({ name: '', category: '', status: 'not_started' });
    setShowAddItem(false);
  };

  return (
    <div className="project-detail">
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <button className="breadcrumb-link" onClick={() => navigate('/')}>대시보드</button>
        <span className="breadcrumb-sep">/</span>
        <button className="breadcrumb-link" onClick={() => navigate('/projects')}>프로젝트</button>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">{project.name}</span>
      </div>

      {/* Project Header */}
      <div className="project-header-card">
        <div className="project-header-info">
          <h2>{project.name}</h2>
          <p className="project-header-desc">{project.description}</p>
          <div className="project-header-meta">
            <ProjectStatusBadge status={project.status} />
            <span>고객사: {project.client}</span>
            <span>기간: {project.startDate} ~ {project.endDate}</span>
            <span>품목: {project.items.length}개</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
          품목 관리
        </button>
        <button className={`tab ${activeTab === 'schedule' ? 'active' : ''}`} onClick={() => setActiveTab('schedule')}>
          일정 관리
        </button>
        <button className={`tab ${activeTab === 'purchase' ? 'active' : ''}`} onClick={() => setActiveTab('purchase')}>
          구매 관리
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'overview' && (
          <div className="overview-tab">
            <div className="section-card">
              <div className="section-header">
                <h3 className="section-title">품목 목록</h3>
                <button className="btn btn-primary" onClick={() => setShowAddItem(true)}>+ 품목 추가</button>
              </div>

              {showAddItem && (
                <form className="inline-form" onSubmit={handleAddItem}>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>품목명</label>
                      <input type="text" value={itemForm.name} onChange={e => setItemForm({ ...itemForm, name: e.target.value })} required />
                    </div>
                    <div className="form-group">
                      <label>카테고리</label>
                      <input type="text" value={itemForm.category} onChange={e => setItemForm({ ...itemForm, category: e.target.value })} required />
                    </div>
                    <div className="form-group">
                      <label>상태</label>
                      <select value={itemForm.status} onChange={e => setItemForm({ ...itemForm, status: e.target.value as ItemStatus })}>
                        <option value="not_started">미착수</option>
                        <option value="in_progress">진행 중</option>
                        <option value="completed">완료</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-actions">
                    <button type="submit" className="btn btn-primary">추가</button>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowAddItem(false)}>취소</button>
                  </div>
                </form>
              )}

              <div className="items-grid">
                {project.items.map(item => (
                  <div key={item.id} className="item-card">
                    <div className="item-card-header">
                      <div>
                        <h4>{item.name}</h4>
                        <span className="item-category">{item.category}</span>
                      </div>
                      <div className="item-card-actions">
                        <ItemStatusBadge status={item.status} />
                        <button
                          className="btn-icon btn-danger"
                          onClick={() => deleteItem(project.id, item.id)}
                          title="삭제"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    <div className="item-card-stats">
                      <div className="item-stat">
                        <span className="item-stat-value">{item.schedules.length}</span>
                        <span className="item-stat-label">일정</span>
                      </div>
                      <div className="item-stat">
                        <span className="item-stat-value">{item.purchases.length}</span>
                        <span className="item-stat-label">발주</span>
                      </div>
                      <div className="item-stat">
                        <span className="item-stat-value">
                          {item.schedules.length > 0
                            ? Math.round(item.schedules.reduce((sum, s) => sum + s.progress, 0) / item.schedules.length)
                            : 0}%
                        </span>
                        <span className="item-stat-label">진행률</span>
                      </div>
                    </div>
                  </div>
                ))}
                {project.items.length === 0 && (
                  <p className="empty-message">등록된 품목이 없습니다. 품목을 추가해주세요.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'schedule' && <ScheduleTab project={project} />}
        {activeTab === 'purchase' && <PurchaseTab project={project} />}
      </div>
    </div>
  );
}
