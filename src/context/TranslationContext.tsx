import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { SavedPhrase, TranslationHistory } from '../types';

// Built-in Zeeco/Burner industry glossary (used as background context for translation)
const GLOSSARY_CONTEXT = `Zeeco 버너/연소 장비 업계 전문 용어:
버너=Burner, 연소실=Combustion Chamber, 파일럿 버너=Pilot Burner, 풍도=Windbox, 노즐=Nozzle,
연료 가스=Fuel Gas, 연료유=Fuel Oil, 열교환기=Heat Exchanger, 가열로=Fired Heater,
소각로=Incinerator, 플레어=Flare, 열풍로=Hot Air Generator, 제어반=Control Panel,
BMS=Burner Management System, 화염 감지기=Flame Detector, 점화기=Ignitor,
차압=Differential Pressure, 열효율=Thermal Efficiency, NOx 배출량=NOx Emission,
턴다운비=Turndown Ratio, 열량=Heat Duty/Heating Value, 도면=Drawing, 사양서=Specification,
견적서=Quotation, 발주서=Purchase Order (PO), 납기일=Delivery Date, 검수=Inspection,
시운전=Commissioning, 성능시험=Performance Test, 공장시험=Factory Acceptance Test (FAT),
현장시험=Site Acceptance Test (SAT), 설계 조건=Design Condition, 운전 조건=Operating Condition,
자재 명세서=Bill of Materials (BOM), 기자재=Equipment & Materials,
공정 배관 계장도=P&ID, 내화물=Refractory, 단열재=Insulation Material,
배기가스=Flue Gas/Exhaust Gas, 과잉공기=Excess Air`;

export type ToneStyle = 'formal' | 'casual';

interface TranslationContextType {
  // API Key
  apiKey: string;
  setApiKey: (key: string) => void;
  apiProvider: 'openai' | 'anthropic';
  setApiProvider: (provider: 'openai' | 'anthropic') => void;

  // Tone
  toneStyle: ToneStyle;
  setToneStyle: (tone: ToneStyle) => void;

  // Saved Phrases (for style learning)
  savedPhrases: SavedPhrase[];
  addSavedPhrase: (phrase: Omit<SavedPhrase, 'id' | 'createdAt'>) => void;
  deleteSavedPhrase: (id: string) => void;

  // Translation History
  history: TranslationHistory[];
  addHistory: (entry: Omit<TranslationHistory, 'id' | 'timestamp'>) => void;
  clearHistory: () => void;

  // Translation
  translate: (text: string, direction: 'ko-en' | 'en-ko', context?: string) => Promise<string>;
  isTranslating: boolean;
}

const TranslationContext = createContext<TranslationContextType | null>(null);

const STORAGE_KEY = 'zeeco-translation';

interface StoredData {
  apiKey: string;
  apiProvider: 'openai' | 'anthropic';
  toneStyle: ToneStyle;
  savedPhrases: SavedPhrase[];
  history: TranslationHistory[];
}

function loadData(): StoredData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      return {
        apiKey: data.apiKey || '',
        apiProvider: data.apiProvider || 'openai',
        toneStyle: data.toneStyle || 'formal',
        savedPhrases: data.savedPhrases || [],
        history: data.history || [],
      };
    }
  } catch { /* ignore */ }
  return {
    apiKey: '',
    apiProvider: 'openai',
    toneStyle: 'formal',
    savedPhrases: [],
    history: [],
  };
}

export function TranslationProvider({ children }: { children: ReactNode }) {
  const initial = loadData();
  const [apiKey, setApiKey] = useState(initial.apiKey);
  const [apiProvider, setApiProvider] = useState<'openai' | 'anthropic'>(initial.apiProvider);
  const [toneStyle, setToneStyle] = useState<ToneStyle>(initial.toneStyle);
  const [savedPhrases, setSavedPhrases] = useState<SavedPhrase[]>(initial.savedPhrases);
  const [history, setHistory] = useState<TranslationHistory[]>(initial.history);
  const [isTranslating, setIsTranslating] = useState(false);

  useEffect(() => {
    const data: StoredData = { apiKey, apiProvider, toneStyle, savedPhrases, history };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [apiKey, apiProvider, toneStyle, savedPhrases, history]);

  const addSavedPhrase = (phrase: Omit<SavedPhrase, 'id' | 'createdAt'>) => {
    setSavedPhrases(prev => [{ ...phrase, id: uuidv4(), createdAt: new Date().toISOString() }, ...prev]);
  };

  const deleteSavedPhrase = (id: string) => {
    setSavedPhrases(prev => prev.filter(p => p.id !== id));
  };

  const addHistory = (entry: Omit<TranslationHistory, 'id' | 'timestamp'>) => {
    setHistory(prev => [{ ...entry, id: uuidv4(), timestamp: new Date().toISOString() }, ...prev].slice(0, 100));
  };

  const clearHistory = () => setHistory([]);

  const buildStyleExamples = (direction: 'ko-en' | 'en-ko') => {
    // Use saved phrases as style reference
    const relevantPhrases = savedPhrases
      .filter(p => {
        if (direction === 'ko-en') return p.korean && p.english;
        return p.english && p.korean;
      })
      .slice(0, 10);

    if (relevantPhrases.length === 0) return '';

    const examples = relevantPhrases
      .map(p => direction === 'ko-en'
        ? `원문: ${p.korean}\n번역: ${p.english}`
        : `원문: ${p.english}\n번역: ${p.korean}`)
      .join('\n\n');

    return `\n\n아래는 사용자가 선호하는 번역 스타일의 예시입니다. 이 화법과 톤을 유지하여 번역하세요:\n${examples}`;
  };

  const translate = async (text: string, direction: 'ko-en' | 'en-ko', context?: string): Promise<string> => {
    if (!apiKey) {
      throw new Error('API 키를 설정해주세요. (설정 탭에서 입력)');
    }

    setIsTranslating(true);
    try {
      const styleExamples = buildStyleExamples(direction);
      const directionPrompt = direction === 'ko-en'
        ? '한국어를 영어로 번역해주세요.'
        : '영어를 한국어로 번역해주세요.';

      const toneGuide = toneStyle === 'formal'
        ? (direction === 'ko-en'
          ? `톤: 공식적 (Formal Business)
- 정중하고 전문적인 비즈니스 영어를 사용하세요.
- "Dear", "I would like to", "Could you please", "Your prompt response would be appreciated" 등의 표현을 사용하세요.
- 수동태, 정중한 요청 표현을 적절히 사용하세요.
- 이메일, 공식 문서에 적합한 톤입니다.`
          : `톤: 공식적 (Formal Business)
- 정중한 존댓말을 사용하세요 (~습니다, ~드립니다).
- "검토 부탁드립니다", "회신 부탁드립니다" 등의 격식 표현을 사용하세요.
- 이메일, 공식 문서에 적합한 톤입니다.`)
        : (direction === 'ko-en'
          ? `톤: 캐주얼 (Teams/Slack 메시지)
- 간결하고 가벼운 톤으로 번역하세요.
- "Hi", "Thanks", "Let me know", "FYI", "Just checking" 등의 캐주얼한 표현을 사용하세요.
- 문장을 짧게 유지하세요.
- Teams, Slack 같은 메신저에서 동료에게 보내는 톤입니다.`
          : `톤: 캐주얼 (Teams/Slack 메시지)
- 가벼운 존댓말을 사용하세요 (~요, ~세요).
- "확인 부탁해요", "참고해주세요", "감사해요" 등의 부드러운 표현을 사용하세요.
- Teams, Slack 같은 메신저에서 동료에게 보내는 톤입니다.`);

      const systemPrompt = `당신은 Zeeco Korea (버너/연소 장비 전문 회사)의 프로젝트 엔지니어를 위한 전문 번역가입니다.

${GLOSSARY_CONTEXT}

${toneGuide}${styleExamples}

${context ? `추가 컨텍스트: ${context}` : ''}

번역만 출력하세요. 설명이나 추가 텍스트는 포함하지 마세요.`;

      let result: string;

      if (apiProvider === 'openai') {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: `${directionPrompt}\n\n${text}` },
            ],
            temperature: 0.3,
          }),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error?.message || `API 오류: ${response.status}`);
        }

        const data = await response.json();
        result = data.choices[0].message.content.trim();
      } else {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 4096,
            system: systemPrompt,
            messages: [
              { role: 'user', content: `${directionPrompt}\n\n${text}` },
            ],
          }),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error?.message || `API 오류: ${response.status}`);
        }

        const data = await response.json();
        result = data.content[0].text.trim();
      }

      addHistory({ source: text, result, direction });
      return result;
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <TranslationContext.Provider value={{
      apiKey, setApiKey, apiProvider, setApiProvider,
      toneStyle, setToneStyle,
      savedPhrases, addSavedPhrase, deleteSavedPhrase,
      history, addHistory, clearHistory,
      translate, isTranslating,
    }}>
      {children}
    </TranslationContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(TranslationContext);
  if (!ctx) throw new Error('useTranslation must be used within TranslationProvider');
  return ctx;
}
