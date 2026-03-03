import { useProjects } from '../context/ProjectContext';
import MindMap from '../components/MindMap';
import { ProjectStatusBadge } from '../components/StatusBadge';

export default function Dashboard() {
  const { projects } = useProjects();

  const visibleProjects = projects.filter(p => !p.hidden);
  const totalItems = visibleProjects.reduce((sum, p) => sum + p.items.length, 0);
  const completedItems = visibleProjects.reduce(
    (sum, p) => sum + p.items.filter(i => i.status === 'completed').length, 0
  );
  const inProgressProjects = visibleProjects.filter(p => p.status === 'in_progress').length;
  const allPurchases = visibleProjects.flatMap(p => p.items.flatMap(i => i.purchases));
  const pendingPurchases = allPurchases.filter(p => p.status !== 'delivered' && p.status !== 'partial_delivered').length;

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>프로젝트 대시보드</h2>
        <p className="page-desc">마인드맵에서 프로젝트를 클릭하면 상세 페이지로 이동합니다.</p>
      </div>

      {/* Summary */}
      <div className="summary-cards">
        <div className="summary-card">
          <div className="summary-value">{visibleProjects.length}</div>
          <div className="summary-label">전체 프로젝트</div>
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

      {/* Mind Map */}
      <div className="section-card">
        <h3 className="section-title">프로젝트 마인드맵</h3>
        <MindMap projects={projects} />
      </div>

      {/* Recent Activity */}
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
                  <tr key={project.id}>
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
