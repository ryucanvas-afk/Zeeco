import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '../context/ProjectContext';
import type { Project, ProjectStatus } from '../types';
import { PROJECT_COLORS } from '../data/sampleData';
import EditableCell from './EditableCell';

const statusLabels: Record<ProjectStatus, string> = {
  planning: '계획 중',
  in_progress: '진행 중',
  completed: '완료',
  on_hold: '보류',
};

const projectStatusOptions = [
  { value: 'planning', label: '계획 중' },
  { value: 'in_progress', label: '진행 중' },
  { value: 'completed', label: '완료' },
  { value: 'on_hold', label: '보류' },
];

interface MindMapProps {
  projects: Project[];
}

export default function MindMap({ projects }: MindMapProps) {
  const navigate = useNavigate();
  const { updateProject, toggleHideProject, deleteProject, addProject } = useProjects();
  const [showPanel, setShowPanel] = useState(false);
  const [colorPickerFor, setColorPickerFor] = useState<string | null>(null);

  const visibleProjects = projects.filter(p => !p.hidden);
  const centerX = 400;
  const centerY = 300;
  const radius = 220;
  const circleR = 50;

  const handleAddProject = () => {
    addProject({
      name: '새 프로젝트',
      projectNo: '',
      description: '',
      headerNote: '',
      status: 'planning',
      contractDate: '',
      komDate: '',
      deliveryDate: '',
      deliverySchedules: [],
      client: '',
      color: PROJECT_COLORS[projects.length % PROJECT_COLORS.length],
      hidden: false,
      budgetKRW: 0,
      budgetUSD: 0,
      exchangeRate: 1350,
      eurExchangeRate: 1500,
      targetGM: 0,
      currentGM: 0,
      engineeringCost: 0,
      directCost: 0,
      contingency: 0,
      needsFactoryManagement: false,
      initialContractAmount: 0,
      initialContractAmountUSD: 0,
      updatedContractAmount: 0,
      updatedContractAmountUSD: 0,
      contractAmountUSD: 0,
      budgetItems: [],
      budgetSnapshots: [],
    });
  };

  return (
    <div className="mindmap-wrapper">
      <div className="mindmap-toolbar">
        <button className="btn btn-primary" onClick={handleAddProject}>+ 프로젝트 추가</button>
        <button className="btn btn-secondary" onClick={() => setShowPanel(!showPanel)}>
          {showPanel ? '패널 닫기' : '프로젝트 관리'}
        </button>
      </div>

      {showPanel && (
        <div className="mindmap-panel">
          {projects.map(p => (
            <div key={p.id} className={`mindmap-panel-item ${p.hidden ? 'panel-item-hidden' : ''}`}>
              <div className="panel-item-color" style={{ backgroundColor: p.color }} onClick={() => setColorPickerFor(colorPickerFor === p.id ? null : p.id)} />
              {colorPickerFor === p.id && (
                <div className="color-picker-popup">
                  {PROJECT_COLORS.map(c => (
                    <div
                      key={c}
                      className={`color-swatch ${p.color === c ? 'active' : ''}`}
                      style={{ backgroundColor: c }}
                      onClick={() => { updateProject(p.id, { color: c }); setColorPickerFor(null); }}
                    />
                  ))}
                </div>
              )}
              <span className="panel-item-name">{p.name}</span>
              <EditableCell
                value={p.status}
                type="select"
                options={projectStatusOptions}
                onSave={v => updateProject(p.id, { status: v as ProjectStatus })}
              />
              <div className="panel-item-dates">
                <EditableCell value={p.contractDate || ''} type="date" onSave={v => updateProject(p.id, { contractDate: v })} placeholder="계약일" />
                <span>~</span>
                <EditableCell value={p.deliveryDate || ''} type="date" onSave={v => updateProject(p.id, { deliveryDate: v })} placeholder="납기일" />
              </div>
              <div className="panel-item-actions">
                <button className="btn-icon" onClick={() => toggleHideProject(p.id)} title={p.hidden ? '표시' : '숨김'}>
                  {p.hidden ? '◉' : '◎'}
                </button>
                <button className="btn-icon btn-danger" onClick={() => deleteProject(p.id)} title="삭제">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mindmap-container">
        <svg viewBox="0 0 800 600" className="mindmap-svg">
          {/* Project nodes and lines */}
          {visibleProjects.map((project, index) => {
            const angle = (2 * Math.PI * index) / visibleProjects.length - Math.PI / 2;
            const nodeX = centerX + radius * Math.cos(angle);
            const nodeY = centerY + radius * Math.sin(angle);
            const color = project.color || '#3b82f6';

            // Line starts from outside the circle border
            const lineStartX = centerX + (circleR + 3) * Math.cos(angle);
            const lineStartY = centerY + (circleR + 3) * Math.sin(angle);

            const totalItems = project.items.length;
            const completedItems = project.items.filter(i => i.status === 'completed').length;
            const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

            return (
              <g key={project.id}>
                {/* Connection line - starts outside circle */}
                <line
                  x1={lineStartX}
                  y1={lineStartY}
                  x2={nodeX}
                  y2={nodeY}
                  stroke={color}
                  strokeWidth={2}
                  strokeDasharray="6,3"
                  opacity={0.5}
                />

                {/* Node */}
                <g className="mindmap-node" onClick={() => navigate(`/project/${project.id}`)}>
                  <rect
                    x={nodeX - 90}
                    y={nodeY - 40}
                    width={180}
                    height={80}
                    rx={12}
                    fill="rgba(255,255,255,0.85)"
                    stroke={color}
                    strokeWidth={2}
                    className="node-rect"
                    style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.08))' }}
                  />
                  <circle cx={nodeX - 70} cy={nodeY - 20} r={5} fill={color} />
                  <text x={nodeX - 58} y={nodeY - 16} fill="#1a1a2e" fontSize={11} fontWeight="bold">
                    {project.name.length > 20 ? project.name.substring(0, 20) + '...' : project.name}
                  </text>
                  <text x={nodeX - 70} y={nodeY + 2} fill="#6b7280" fontSize={9}>
                    {project.client}
                  </text>
                  <text x={nodeX - 70} y={nodeY + 18} fill={color} fontSize={9}>
                    {statusLabels[project.status]}
                  </text>
                  <rect x={nodeX + 10} y={nodeY + 10} width={60} height={6} rx={3} fill="rgba(0,0,0,0.08)" />
                  <rect x={nodeX + 10} y={nodeY + 10} width={60 * progress / 100} height={6} rx={3} fill={color} />
                  <text x={nodeX + 75} y={nodeY + 16} fill="#6b7280" fontSize={8}>
                    {progress}%
                  </text>
                  <text x={nodeX + 10} y={nodeY + 2} fill="#6b7280" fontSize={9}>
                    {totalItems} items
                  </text>
                </g>
              </g>
            );
          })}

          {/* Center node - drawn on top */}
          <circle cx={centerX} cy={centerY} r={circleR} fill="rgba(255,255,255,0.9)" stroke="#ef4444" strokeWidth={3} style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.1))' }} />
          <text x={centerX} y={centerY - 8} textAnchor="middle" fill="#ef4444" fontSize={14} fontWeight="bold">ZEECO</text>
          <text x={centerX} y={centerY + 12} textAnchor="middle" fill="#6b7280" fontSize={10}>Projects</text>
        </svg>
      </div>
    </div>
  );
}
