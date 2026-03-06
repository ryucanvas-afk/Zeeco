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
export type ModelTier = 'quality' | 'economy';

interface TranslationContextType {
  // API Keys (separate per provider)
  openaiKey: string;
  setOpenaiKey: (key: string) => void;
  anthropicKey: string;
  setAnthropicKey: (key: string) => void;
  apiProvider: 'openai' | 'anthropic';
  setApiProvider: (provider: 'openai' | 'anthropic') => void;

  // Model tier
  modelTier: ModelTier;
  setModelTier: (tier: ModelTier) => void;

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
  openaiKey: string;
  anthropicKey: string;
  apiProvider: 'openai' | 'anthropic';
  modelTier: ModelTier;
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
        openaiKey: data.openaiKey || data.apiKey || '',
        anthropicKey: data.anthropicKey || '',
        apiProvider: data.apiProvider || 'anthropic',
        modelTier: data.modelTier || 'quality',
        toneStyle: data.toneStyle || 'formal',
        savedPhrases: data.savedPhrases || [],
        history: data.history || [],
      };
    }
  } catch { /* ignore */ }
  return {
    openaiKey: '',
    anthropicKey: '',
    apiProvider: 'anthropic',
    modelTier: 'quality',
    toneStyle: 'formal',
    savedPhrases: [],
    history: [],
  };
}

export function TranslationProvider({ children }: { children: ReactNode }) {
  const initial = loadData();
  const [openaiKey, setOpenaiKey] = useState(initial.openaiKey);
  const [anthropicKey, setAnthropicKey] = useState(initial.anthropicKey);
  const [apiProvider, setApiProvider] = useState<'openai' | 'anthropic'>(initial.apiProvider);
  const [modelTier, setModelTier] = useState<ModelTier>(initial.modelTier);
  const [toneStyle, setToneStyle] = useState<ToneStyle>(initial.toneStyle);
  const [savedPhrases, setSavedPhrases] = useState<SavedPhrase[]>(initial.savedPhrases);
  const [history, setHistory] = useState<TranslationHistory[]>(initial.history);
  const [isTranslating, setIsTranslating] = useState(false);

  useEffect(() => {
    const data: StoredData = { openaiKey, anthropicKey, apiProvider, modelTier, toneStyle, savedPhrases, history };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [openaiKey, anthropicKey, apiProvider, modelTier, toneStyle, savedPhrases, history]);

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
    const apiKey = apiProvider === 'openai' ? openaiKey : anthropicKey;
    if (!apiKey) {
      throw new Error(`${apiProvider === 'openai' ? 'OpenAI' : 'Anthropic'} API 키를 설정해주세요. (설정 탭에서 입력)`);
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

      const systemPrompt = `당신은 Zeeco Korea (버너/연소 장비 전문 회사)에서 10년 이상 근무한 시니어 프로젝트 엔지니어입니다.
미국 본사, 해외 파트너, 한국 고객사와 매일 이메일과 메시지를 주고받는 실무자로서 번역합니다.

핵심 원칙:
1. 절대 직역하지 마세요. "이 사람이 실제로 전달하려는 메시지가 뭔가?"를 먼저 파악한 후, 받는 사람 입장에서 자연스러운 문장으로 작성하세요.
2. 엔지니어링/프로젝트 관리 맥락을 반드시 반영하세요. 도면 리비전, 납기, 검수, 발주, 시운전 등의 업무 흐름을 이해하고 있습니다.
3. 원문에 없더라도 비즈니스 관례상 당연한 인사, 연결어, 마무리 표현을 자연스럽게 추가하세요.
4. 한국어→영어: 한국어는 주어/목적어를 생략하고 함축적으로 표현하는 경향이 있습니다. 영어로 번역할 때는 생략된 주어를 복원하고, 맥락을 명확하게 풀어쓰세요.
5. 영어→한국어: 영어의 장황한 수식어와 관계절을 한국 비즈니스 문화에 맞게 간결하게 다듬으세요. 한국어답게 끊어서 작성하세요.

<예시 - 이렇게 번역하세요>
[한→영 나쁜 예] "도면 리비전 확인 부탁드립니다" → "Please check the drawing revision." (직역, 맥락 없음)
[한→영 좋은 예] "도면 리비전 확인 부탁드립니다" → "Could you please review the latest drawing revision and confirm if it's acceptable? We'd like to proceed with fabrication once approved."

[영→한 나쁜 예] "We need to expedite the delivery schedule due to the client's revised timeline." → "우리는 고객의 수정된 일정으로 인해 납품 일정을 앞당길 필요가 있습니다." (어색한 직역)
[영→한 좋은 예] "We need to expedite the delivery schedule due to the client's revised timeline." → "고객사 일정이 변경되어 납기를 앞당겨야 할 것 같습니다."

[한→영 나쁜 예] "내일까지 보내주세요" → "Please send it by tomorrow." (맥락 부족)
[한→영 좋은 예] "내일까지 보내주세요" → "Could you please send it over by tomorrow? We need to finalize the package before the deadline."
</예시>

${GLOSSARY_CONTEXT}

${toneGuide}${styleExamples}

${context ? `추가 컨텍스트: ${context}` : ''}

번역만 출력하세요. 설명, 대안, 메모 등 추가 텍스트는 절대 포함하지 마세요.`;

      let result: string;
      let apiBody: Record<string, unknown>;

      const openaiModel = modelTier === 'quality' ? 'gpt-4o' : 'gpt-4o-mini';
      const anthropicModel = modelTier === 'quality' ? 'claude-sonnet-4-5-20241022' : 'claude-haiku-4-5-20251001';

      if (apiProvider === 'openai') {
        apiBody = {
          model: openaiModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `${directionPrompt}\n\n${text}` },
          ],
          temperature: 0.4,
        };
      } else {
        apiBody = {
          model: anthropicModel,
          max_tokens: 4096,
          system: systemPrompt,
          messages: [
            { role: 'user', content: `${directionPrompt}\n\n${text}` },
          ],
        };
      }

      // Direct API call (works on GitHub Pages / external access)
      let directUrl: string;
      let directHeaders: Record<string, string>;

      if (apiProvider === 'openai') {
        directUrl = 'https://api.openai.com/v1/chat/completions';
        directHeaders = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        };
      } else {
        directUrl = 'https://api.anthropic.com/v1/messages';
        directHeaders = {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        };
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: any;

      try {
        const res = await fetch(directUrl, {
          method: 'POST',
          headers: directHeaders,
          body: JSON.stringify(apiBody),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error?.message || `API 오류: ${res.status}`);
        }
        data = await res.json();
      } catch (directErr) {
        // Direct call failed (CORS etc.) - try server proxy as fallback
        const errMsg = directErr instanceof Error ? directErr.message : '';
        if (!errMsg.includes('Failed to fetch') && !errMsg.includes('NetworkError')) {
          throw directErr;
        }

        const proxyRes = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider: apiProvider, apiKey, body: apiBody }),
        });

        if (!proxyRes.ok) {
          const err = await proxyRes.json().catch(() => ({}));
          throw new Error(err.error?.message || `API 오류: ${proxyRes.status}`);
        }
        data = await proxyRes.json();
      }

      if (apiProvider === 'openai') {
        result = data.choices[0].message.content.trim();
      } else {
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
      openaiKey, setOpenaiKey, anthropicKey, setAnthropicKey, apiProvider, setApiProvider,
      modelTier, setModelTier, toneStyle, setToneStyle,
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
