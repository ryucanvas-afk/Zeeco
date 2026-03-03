import { useNavigate } from 'react-router-dom';
import type { Project, ProjectStatus } from '../types';

const statusColors: Record<ProjectStatus, string> = {
  planning: '#6366f1',
  in_progress: '#f59e0b',
  completed: '#10b981',
  on_hold: '#ef4444',
};

const statusLabels: Record<ProjectStatus, string> = {
  planning: '계획 중',
  in_progress: '진행 중',
  completed: '완료',
  on_hold: '보류',
};

interface MindMapProps {
  projects: Project[];
}

export default function MindMap({ projects }: MindMapProps) {
  const navigate = useNavigate();

  const centerX = 400;
  const centerY = 300;
  const radius = 220;

  return (
    <div className="mindmap-container">
      <svg viewBox="0 0 800 600" className="mindmap-svg">
        {/* Center node */}
        <circle cx={centerX} cy={centerY} r={50} fill="#1e293b" stroke="#3b82f6" strokeWidth={3} />
        <text x={centerX} y={centerY - 8} textAnchor="middle" fill="white" fontSize={14} fontWeight="bold">ZEECO</text>
        <text x={centerX} y={centerY + 12} textAnchor="middle" fill="#94a3b8" fontSize={10}>Projects</text>

        {/* Project nodes */}
        {projects.map((project, index) => {
          const angle = (2 * Math.PI * index) / projects.length - Math.PI / 2;
          const nodeX = centerX + radius * Math.cos(angle);
          const nodeY = centerY + radius * Math.sin(angle);
          const color = statusColors[project.status];

          const totalItems = project.items.length;
          const completedItems = project.items.filter(i => i.status === 'completed').length;
          const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

          return (
            <g key={project.id} className="mindmap-node" onClick={() => navigate(`/project/${project.id}`)}>
              {/* Connection line */}
              <line
                x1={centerX}
                y1={centerY}
                x2={nodeX}
                y2={nodeY}
                stroke={color}
                strokeWidth={2}
                strokeDasharray="6,3"
                opacity={0.5}
              />

              {/* Node background */}
              <rect
                x={nodeX - 90}
                y={nodeY - 40}
                width={180}
                height={80}
                rx={12}
                fill="#1e293b"
                stroke={color}
                strokeWidth={2}
                className="node-rect"
              />

              {/* Status indicator */}
              <circle cx={nodeX - 70} cy={nodeY - 20} r={5} fill={color} />

              {/* Project name */}
              <text x={nodeX - 58} y={nodeY - 16} fill="white" fontSize={11} fontWeight="bold">
                {project.name.length > 20 ? project.name.substring(0, 20) + '...' : project.name}
              </text>

              {/* Client */}
              <text x={nodeX - 70} y={nodeY + 2} fill="#94a3b8" fontSize={9}>
                {project.client}
              </text>

              {/* Status label */}
              <text x={nodeX - 70} y={nodeY + 18} fill={color} fontSize={9}>
                {statusLabels[project.status]}
              </text>

              {/* Progress */}
              <rect x={nodeX + 10} y={nodeY + 10} width={60} height={6} rx={3} fill="#334155" />
              <rect x={nodeX + 10} y={nodeY + 10} width={60 * progress / 100} height={6} rx={3} fill={color} />
              <text x={nodeX + 75} y={nodeY + 16} fill="#94a3b8" fontSize={8}>
                {progress}%
              </text>

              {/* Items count */}
              <text x={nodeX + 10} y={nodeY + 2} fill="#64748b" fontSize={9}>
                {totalItems} items
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
