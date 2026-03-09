import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '../context/ProjectContext';
import MindMap from '../components/MindMap';
import { ProjectStatusBadge } from '../components/StatusBadge';

function dateToStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function Dashboard() {
  const { projects } = useProjects();
  const navigate = useNavigate();
  const [showProjectList, setShowProjectList] = useState(false);

  const visibleProjects = projects.filter(p => !p.hidden);
  const totalItems = visibleProjects.reduce((sum, p) => sum + p.items.length, 0);
  const completedItems = visibleProjects.reduce(
    (sum, p) => sum + p.items.filter(i => i.status === 'completed').length, 0
  );
  const inProgressProjects = visibleProjects.filter(p => p.status === 'in_progress').length;
  const allPurchases = visibleProjects.flatMap(p => p.items.flatMap(i => i.purchases));
  const pendingPurchases = allPurchases.filter(p => p.status !== 'delivered' && p.status !== 'partial_delivered').length;

  // Upcoming inspections (next 30 days)
  const todayStr = dateToStr(new Date());
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);
  const futureStr = dateToStr(futureDate);

  const upcomingInspections = visibleProjects.flatMap(p =>
    (p.inspections || []).map(ins => ({ ...ins, projectName: p.name, projectId: p.id }))
  ).filter(ins => {
    const endDate = ins.endDate || ins.date;
    return endDate >= todayStr && ins.date <= futureStr;
  }).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>프로젝트 대시보드</h2>
        <p className="page-desc">마인드맵에서 프로젝트를 클릭하면 상세 페이지로 이동합니다.</p>
      </div>

      {/* Summary */}
      <div className="summary-cards">
        <div
          className="summary-card summary-card-clickable"
          onClick={() => setShowProjectList(!showProjectList)}
          title="클릭하여 프로젝트 목록 보기"
        >
          <div className="summary-value">{visibleProjects.length}</div>
          <div className="summary-label">전체 프로젝트 ▾</div>
        </div>
        <div className="summary-card card-ordered">
          <div className="summary-value">{inProgressProjects}</div>
          <div className="summary-label">진행 중</div>
        </div>
        <div className="summary-card card-shipped">
          <div className="summary-value">{totalItems}</div>
          <div className="summary-label">전체 품목</div>
        </div>
        <div className="summary-card card-delivered">
          <div className="summary-value">{completedItems}</div>
          <div className="summary-label">완료 품목</div>
        </div>
        <div className="summary-card card-pending">
          <div className="summary-value">{pendingPurchases}</div>
          <div className="summary-label">미입고 발주</div>
        </div>
      </div>

      {/* Project List Dropdown */}
      {showProjectList && (
        <div className="section-card dashboard-project-list">
          <h3 className="section-title">프로젝트 목록</h3>
          <div className="dashboard-project-items">
            {visibleProjects.map(project => {
              const items = project.items.length;
              const done = project.items.filter(i => i.status === 'completed').length;
              const progress = items > 0 ? Math.round((done / items) * 100) : 0;
              return (
                <div
                  key={project.id}
                  className="dashboard-project-item"
                  style={{ borderLeft: `4px solid ${project.color || '#3b82f6'}` }}
                  onClick={() => navigate(`/project/${project.id}`)}
                >
                  <div className="dashboard-project-item-info">
                    <span className="dashboard-project-item-name">{project.name}</span>
                    {project.projectNo && <span className="dashboard-project-item-no">{project.projectNo}</span>}
                    <span className="dashboard-project-item-client">{project.client}</span>
                  </div>
                  <div className="dashboard-project-item-right">
                    <ProjectStatusBadge status={project.status} />
                    <div className="progress-cell" style={{ minWidth: 80 }}>
                      <div className="progress-bar-bg">
                        <div
                          className="progress-bar-fill"
                          style={{ width: `${progress}%`, backgroundColor: progress === 100 ? '#10b981' : project.color || '#3b82f6' }}
                        />
                      </div>
                      <span>{progress}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Mind Map */}
      <div className="section-card">
        <h3 className="section-title">프로젝트 마인드맵</h3>
        <MindMap projects={projects} />
      </div>

      {/* Upcoming Inspections */}
      {upcomingInspections.length > 0 && (
        <div className="section-card">
          <h3 className="section-title">예정된 검사 일정 (30일 이내)</h3>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>프로젝트</th>
                  <th>검사 기간</th>
                  <th>검사 품목</th>
                  <th>검사 항목</th>
                  <th>장소</th>
                  <th>담당자</th>
                </tr>
              </thead>
              <tbody>
                {upcomingInspections.slice(0, 10).map(ins => (
                  <tr key={ins.id}>
                    <td className="td-bold">{ins.projectName}</td>
                    <td>{ins.endDate && ins.endDate !== ins.date ? `${ins.date} ~ ${ins.endDate}` : ins.date}</td>
                    <td>{ins.items.join(', ') || '-'}</td>
                    <td>{ins.categories.join(', ') || '-'}</td>
                    <td>{ins.location || '-'}</td>
                    <td>{ins.inspector || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Project Status Summary */}
      <div className="section-card">
        <h3 className="section-title">프로젝트 현황 요약</h3>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>프로젝트</th>
                <th>고객사</th>
                <th>상태</th>
                <th>품목 수</th>
                <th>기간</th>
                <th>진행률</th>
              </tr>
            </thead>
            <tbody>
              {visibleProjects.map(project => {
                const items = project.items.length;
                const done = project.items.filter(i => i.status === 'completed').length;
                const progress = items > 0 ? Math.round((done / items) * 100) : 0;
                return (
                  <tr
                    key={project.id}
                    className="dashboard-summary-row"
                    onClick={() => navigate(`/project/${project.id}`)}
                    title="클릭하여 프로젝트로 이동"
                  >
                    <td className="td-bold">{project.name}</td>
                    <td>{project.client}</td>
                    <td><ProjectStatusBadge status={project.status} /></td>
                    <td>{items}</td>
                    <td>{project.contractDate || '-'} ~ {project.deliveryDate || '-'}</td>
                    <td>
                      <div className="progress-cell">
                        <div className="progress-bar-bg">
                          <div
                            className="progress-bar-fill"
                            style={{
                              width: `${progress}%`,
                              backgroundColor: progress === 100 ? '#10b981' : '#3b82f6',
                            }}
                          />
                        </div>
                        <span>{progress}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
