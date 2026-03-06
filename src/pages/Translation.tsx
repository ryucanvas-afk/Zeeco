import { useState } from 'react';
import { useTranslation, type ToneStyle } from '../context/TranslationContext';

type TabType = 'translate' | 'phrases' | 'history' | 'settings';

export default function Translation() {
  const {
    openaiKey, setOpenaiKey, anthropicKey, setAnthropicKey,
    apiProvider, setApiProvider,
    toneStyle, setToneStyle,
    savedPhrases, addSavedPhrase, deleteSavedPhrase,
    history, clearHistory,
    translate, isTranslating,
  } = useTranslation();

  const hasApiKey = apiProvider === 'openai' ? !!openaiKey : !!anthropicKey;

  const [activeTab, setActiveTab] = useState<TabType>('translate');
  const [direction, setDirection] = useState<'ko-en' | 'en-ko'>('ko-en');
  const [sourceText, setSourceText] = useState('');
  const [resultText, setResultText] = useState('');
  const [contextHint, setContextHint] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  // Phrase form
  const [phraseForm, setPhraseForm] = useState({ korean: '', english: '', category: '일반' });
  const [showPhraseForm, setShowPhraseForm] = useState(false);
  const [phraseFilter, setPhraseFilter] = useState('');

  const handleTranslate = async () => {
    if (!sourceText.trim()) return;
    setError('');
    setResultText('');
    try {
      const result = await translate(sourceText, direction, contextHint || undefined);
      setResultText(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : '번역 중 오류가 발생했습니다.');
    }
  };

  const handleSwapDirection = () => {
    setDirection(prev => prev === 'ko-en' ? 'en-ko' : 'ko-en');
    if (resultText) {
      setSourceText(resultText);
      setResultText('');
    }
  };

  const handleCopy = async () => {
    if (!resultText) return;
    await navigator.clipboard.writeText(resultText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveAsPhrase = () => {
    if (!sourceText || !resultText) return;
    const korean = direction === 'ko-en' ? sourceText : resultText;
    const english = direction === 'ko-en' ? resultText : sourceText;
    addSavedPhrase({ korean, english, category: '번역 저장' });
    setSavedMsg('문구가 저장되었습니다!');
    setTimeout(() => setSavedMsg(''), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleTranslate();
    }
  };

  const filteredPhrases = phraseFilter
    ? savedPhrases.filter(p =>
        p.korean.toLowerCase().includes(phraseFilter.toLowerCase()) ||
        p.english.toLowerCase().includes(phraseFilter.toLowerCase()) ||
        p.category.toLowerCase().includes(phraseFilter.toLowerCase()))
    : savedPhrases;

  const toneOptions: { value: ToneStyle; label: string; desc: string }[] = [
    { value: 'formal', label: '공식', desc: '이메일, 공식 문서용' },
    { value: 'casual', label: '캐주얼', desc: 'Teams, Slack 메시지용' },
  ];

  const tabs: { key: TabType; label: string }[] = [
    { key: 'translate', label: '번역' },
    { key: 'phrases', label: `저장 문구 (${savedPhrases.length})` },
    { key: 'history', label: '기록' },
    { key: 'settings', label: '설정' },
  ];

  return (
    <div className="translation-page">
      <div className="translation-header">
        <h2>번역 도구</h2>
        <p className="translation-subtitle">Zeeco 프로젝트 엔지니어 전용 한영/영한 번역</p>
      </div>

      <div className="tabs" style={{ marginBottom: '1.5rem' }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ===== TRANSLATE TAB ===== */}
      {activeTab === 'translate' && (
        <div className="translate-section">
          {/* Tone selector */}
          <div className="tone-selector">
            <span className="tone-label">화법:</span>
            {toneOptions.map(opt => (
              <button
                key={opt.value}
                className={`tone-btn ${toneStyle === opt.value ? 'active' : ''}`}
                onClick={() => setToneStyle(opt.value)}
                title={opt.desc}
              >
                {opt.label}
                <span className="tone-desc">{opt.desc}</span>
              </button>
            ))}
          </div>

          {/* Direction bar */}
          <div className="direction-bar">
            <span className="direction-lang">{direction === 'ko-en' ? '한국어' : 'English'}</span>
            <button className="direction-swap-btn" onClick={handleSwapDirection} title="방향 전환">
              ⇄
            </button>
            <span className="direction-lang">{direction === 'ko-en' ? 'English' : '한국어'}</span>
          </div>

          {/* Translation panels */}
          <div className="translate-panels">
            <div className="translate-panel source-panel">
              <textarea
                className="translate-textarea"
                value={sourceText}
                onChange={e => setSourceText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={direction === 'ko-en'
                  ? '한국어 텍스트를 입력하세요...'
                  : 'Enter English text...'}
                rows={8}
              />
              <div className="textarea-footer">
                <span className="char-count">{sourceText.length}자</span>
              </div>
            </div>

            <div className="translate-panel result-panel">
              <div className="translate-result-area">
                {isTranslating ? (
                  <div className="translating-indicator">
                    <span className="spinner" />
                    번역 중...
                  </div>
                ) : resultText ? (
                  <div className="translate-result-text">{resultText}</div>
                ) : (
                  <div className="translate-placeholder">
                    번역 결과가 여기에 표시됩니다
                  </div>
                )}
              </div>
              {resultText && (
                <div className="textarea-footer">
                  <button className="btn btn-sm btn-ghost" onClick={handleCopy}>
                    {copied ? '복사됨!' : '복사'}
                  </button>
                  <button className="btn btn-sm btn-ghost" onClick={handleSaveAsPhrase}>
                    {savedMsg || '문구 저장'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Context hint */}
          <div className="context-hint-row">
            <input
              type="text"
              className="context-hint-input"
              value={contextHint}
              onChange={e => setContextHint(e.target.value)}
              placeholder="추가 컨텍스트 (선택사항): 예) 이메일 회신, 검수 관련, 납기 독촉"
            />
          </div>

          {/* Translate button */}
          <div className="translate-actions">
            <button
              className="btn btn-primary btn-translate"
              onClick={handleTranslate}
              disabled={isTranslating || !sourceText.trim() || !hasApiKey}
            >
              {isTranslating ? '번역 중...' : '번역하기'}
              {!isTranslating && <span className="btn-shortcut">Ctrl+Enter</span>}
            </button>
            {!hasApiKey && (
              <span className="api-warning">설정 탭에서 API 키를 먼저 입력하세요</span>
            )}
          </div>

          {error && <div className="translate-error">{error}</div>}
        </div>
      )}

      {/* ===== PHRASES TAB ===== */}
      {activeTab === 'phrases' && (
        <div className="phrases-section">
          <div className="phrases-header">
            <p className="phrases-info">
              저장된 문구는 번역 시 AI에게 스타일 참고 자료로 전달됩니다.
              문구를 많이 저장할수록 본인의 화법이 더 잘 반영됩니다.
            </p>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowPhraseForm(!showPhraseForm)}
            >
              {showPhraseForm ? '취소' : '+ 문구 추가'}
            </button>
          </div>

          {showPhraseForm && (
            <div className="phrase-form">
              <div className="form-grid-2">
                <div className="form-group">
                  <label>한국어</label>
                  <textarea
                    value={phraseForm.korean}
                    onChange={e => setPhraseForm(prev => ({ ...prev, korean: e.target.value }))}
                    placeholder="한국어 표현"
                    rows={3}
                  />
                </div>
                <div className="form-group">
                  <label>English</label>
                  <textarea
                    value={phraseForm.english}
                    onChange={e => setPhraseForm(prev => ({ ...prev, english: e.target.value }))}
                    placeholder="English expression"
                    rows={3}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label>카테고리</label>
                  <select
                    value={phraseForm.category}
                    onChange={e => setPhraseForm(prev => ({ ...prev, category: e.target.value }))}
                  >
                    <option value="일반">일반</option>
                    <option value="인사/마무리">인사/마무리</option>
                    <option value="요청">요청</option>
                    <option value="확인">확인</option>
                    <option value="기술">기술</option>
                    <option value="납기">납기</option>
                    <option value="검수">검수</option>
                  </select>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    if (phraseForm.korean && phraseForm.english) {
                      addSavedPhrase(phraseForm);
                      setPhraseForm({ korean: '', english: '', category: '일반' });
                      setShowPhraseForm(false);
                    }
                  }}
                >
                  저장
                </button>
              </div>
            </div>
          )}

          <div className="phrases-search">
            <input
              type="text"
              placeholder="문구 검색..."
              value={phraseFilter}
              onChange={e => setPhraseFilter(e.target.value)}
            />
          </div>

          {filteredPhrases.length === 0 ? (
            <div className="empty-state">
              저장된 문구가 없습니다. 번역 결과를 저장하거나 직접 추가하세요.
            </div>
          ) : (
            <div className="phrases-list">
              {filteredPhrases.map(phrase => (
                <div key={phrase.id} className="phrase-card">
                  <div className="phrase-category-badge">{phrase.category}</div>
                  <div className="phrase-content">
                    <div className="phrase-lang">
                      <span className="phrase-lang-label">KO</span>
                      <span>{phrase.korean}</span>
                    </div>
                    <div className="phrase-lang">
                      <span className="phrase-lang-label">EN</span>
                      <span>{phrase.english}</span>
                    </div>
                  </div>
                  <div className="phrase-actions">
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => {
                        setSourceText(direction === 'ko-en' ? phrase.korean : phrase.english);
                        setActiveTab('translate');
                      }}
                    >
                      사용
                    </button>
                    <button
                      className="btn btn-sm btn-ghost btn-danger-text"
                      onClick={() => deleteSavedPhrase(phrase.id)}
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== HISTORY TAB ===== */}
      {activeTab === 'history' && (
        <div className="history-section">
          <div className="history-header">
            <span>{history.length}건의 번역 기록</span>
            {history.length > 0 && (
              <button className="btn btn-sm btn-ghost btn-danger-text" onClick={clearHistory}>
                기록 삭제
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <div className="empty-state">번역 기록이 없습니다.</div>
          ) : (
            <div className="history-list">
              {history.map(entry => (
                <div key={entry.id} className="history-card">
                  <div className="history-meta">
                    <span className="history-direction">
                      {entry.direction === 'ko-en' ? 'KO → EN' : 'EN → KO'}
                    </span>
                    <span className="history-time">
                      {new Date(entry.timestamp).toLocaleString('ko-KR')}
                    </span>
                  </div>
                  <div className="history-texts">
                    <div className="history-source">{entry.source}</div>
                    <div className="history-arrow">→</div>
                    <div className="history-result">{entry.result}</div>
                  </div>
                  <div className="history-actions">
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => {
                        setSourceText(entry.source);
                        setDirection(entry.direction);
                        setActiveTab('translate');
                      }}
                    >
                      재사용
                    </button>
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => {
                        const ko = entry.direction === 'ko-en' ? entry.source : entry.result;
                        const en = entry.direction === 'ko-en' ? entry.result : entry.source;
                        addSavedPhrase({ korean: ko, english: en, category: '번역 저장' });
                      }}
                    >
                      문구 저장
                    </button>
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => navigator.clipboard.writeText(entry.result)}
                    >
                      결과 복사
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== SETTINGS TAB ===== */}
      {activeTab === 'settings' && (
        <div className="settings-section">
          <div className="settings-card">
            <h3>API 설정</h3>
            <p className="settings-desc">
              번역에 사용할 AI API를 설정합니다. API 키는 브라우저에만 저장됩니다.
            </p>

            <div className="form-group">
              <label>사용할 AI 선택</label>
              <div className="provider-toggle">
                <button
                  className={`provider-btn ${apiProvider === 'openai' ? 'active' : ''}`}
                  onClick={() => setApiProvider('openai')}
                >
                  OpenAI (GPT-4o-mini)
                  {openaiKey && <span className="key-status key-set">키 등록됨</span>}
                </button>
                <button
                  className={`provider-btn ${apiProvider === 'anthropic' ? 'active' : ''}`}
                  onClick={() => setApiProvider('anthropic')}
                >
                  Anthropic (Claude)
                  {anthropicKey && <span className="key-status key-set">키 등록됨</span>}
                </button>
              </div>
            </div>

            <div className="api-keys-section">
              <div className="form-group">
                <label>OpenAI API Key</label>
                <input
                  type="password"
                  value={openaiKey}
                  onChange={e => setOpenaiKey(e.target.value)}
                  placeholder="sk-proj-..."
                />
                <span className="form-hint">platform.openai.com 에서 발급</span>
              </div>
              <div className="form-group">
                <label>Anthropic API Key</label>
                <input
                  type="password"
                  value={anthropicKey}
                  onChange={e => setAnthropicKey(e.target.value)}
                  placeholder="sk-ant-..."
                />
                <span className="form-hint">console.anthropic.com 에서 발급</span>
              </div>
            </div>
          </div>

          <div className="settings-card">
            <h3>화법 학습 안내</h3>
            <div className="style-learning-info">
              <div className="info-item">
                <strong>어떻게 작동하나요?</strong>
                <p>
                  저장된 문구(Saved Phrases)를 번역 시 AI에게 참고 예시로 전달합니다.
                  문구를 많이 저장할수록 본인의 화법이 더 정확하게 반영됩니다.
                </p>
              </div>
              <div className="info-item">
                <strong>추천 사용법</strong>
                <ul>
                  <li>번역 결과가 마음에 들면 "문구 저장"을 눌러주세요.</li>
                  <li>직접 자주 쓰는 표현을 한영 쌍으로 추가하세요.</li>
                  <li>카테고리별로 분류하면 관리가 편합니다.</li>
                  <li>10개 이상 저장하면 화법 반영이 눈에 띄게 좋아집니다.</li>
                </ul>
              </div>
              <div className="info-item">
                <strong>현재 상태</strong>
                <p>저장된 문구: <strong>{savedPhrases.length}개</strong> (최근 10개가 번역 시 참조됨)</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
