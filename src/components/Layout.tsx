import { useRef } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useProjects } from '../context/ProjectContext';

export default function Layout() {
  const { projects, importData } = useProjects();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const dataStr = JSON.stringify(projects, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zeeco-projects-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (Array.isArray(data)) {
          importData(data);
          alert('데이터를 성공적으로 불러왔습니다.');
        } else {
          alert('잘못된 데이터 형식입니다.');
        }
      } catch {
        alert('JSON 파일을 읽을 수 없습니다.');
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be imported again
    e.target.value = '';
  };

  const handleCopyLink = async () => {
    try {
      const dataStr = JSON.stringify(projects);
      const compressed = btoa(encodeURIComponent(dataStr));
      // Check if data fits in URL (practical limit ~2MB for most browsers)
      if (compressed.length > 1500000) {
        // Too large for URL, fall back to export
        alert('데이터가 너무 커서 링크로 공유할 수 없습니다. JSON 파일로 내보내기를 사용해주세요.');
        return;
      }
      const baseUrl = window.location.href.split('?')[0].split('#')[0];
      const shareUrl = `${baseUrl}?data=${compressed}#/`;
      await navigator.clipboard.writeText(shareUrl);
      alert('공유 링크가 클립보드에 복사되었습니다! 이 링크를 다른 사람에게 공유하세요.');
    } catch {
      alert('클립보드 복사에 실패했습니다. JSON 파일로 내보내기를 사용해주세요.');
    }
  };

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="header-left">
          <h1 className="logo" style={{ color: '#ef4444' }}>ZEECO</h1>
          <span className="logo-sub">Project Management</span>
        </div>
        <nav className="header-nav">
          <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            대시보드
          </NavLink>
          <NavLink to="/projects" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            프로젝트 목록
          </NavLink>
          <NavLink to="/todos" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            To-Do
          </NavLink>
          <NavLink to="/translate" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            번역
          </NavLink>
          <div className="nav-share-group">
            <button className="btn btn-sm btn-secondary" onClick={handleCopyLink} title="공유 링크 복사">
              공유 링크
            </button>
            <button className="btn btn-sm btn-secondary" onClick={handleExport} title="JSON 내보내기">
              내보내기
            </button>
            <button className="btn btn-sm btn-secondary" onClick={() => fileInputRef.current?.click()} title="JSON 불러오기">
              불러오기
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleImport}
            />
          </div>
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
