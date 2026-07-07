interface ExtractState {
  knowledgeId: string;
  status: 'extracting' | 'completed' | 'interrupted';
  result: any | null;
  reasoningContent: string;
  textContent: string;
  extractParams: {
    inputType: 'file' | 'text';
    modelId: string;
    prompt: string;
    textContent?: string;
    categoryId?: string;
    deepThinking?: boolean;
  } | null;
  fileUids?: string[];
  extractId?: string;
}

const STORAGE_KEY_PREFIX = 'ai_center_extract_';

export class ExtractManager {
  private static instance: ExtractManager;
  private listeners: Map<string, Set<(state: ExtractState) => void>> = new Map();

  private constructor() {}

  static getInstance(): ExtractManager {
    if (!ExtractManager.instance) {
      ExtractManager.instance = new ExtractManager();
    }
    return ExtractManager.instance;
  }

  getStorageKey(knowledgeId: string): string {
    return `${STORAGE_KEY_PREFIX}${knowledgeId}`;
  }

  getState(knowledgeId: string): ExtractState | null {
    try {
      const data = localStorage.getItem(this.getStorageKey(knowledgeId));
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.error('Failed to get extract state:', e);
    }
    return null;
  }

  setState(knowledgeId: string, state: Partial<ExtractState>): void {
    try {
      const existing = this.getState(knowledgeId) || {
        knowledgeId,
        status: 'interrupted',
        result: null,
        reasoningContent: '',
        textContent: '',
        extractParams: null,
      };
      const newState = { ...existing, ...state };
      localStorage.setItem(this.getStorageKey(knowledgeId), JSON.stringify(newState));
      this.notifyListeners(knowledgeId, newState);
    } catch (e) {
      console.error('Failed to set extract state:', e);
    }
  }

  clearState(knowledgeId: string): void {
    try {
      localStorage.removeItem(this.getStorageKey(knowledgeId));
      const existing = this.getState(knowledgeId);
      if (existing) {
        this.notifyListeners(knowledgeId, { ...existing, status: 'interrupted', result: null });
      }
    } catch (e) {
      console.error('Failed to clear extract state:', e);
    }
  }

  addListener(knowledgeId: string, callback: (state: ExtractState) => void): () => void {
    if (!this.listeners.has(knowledgeId)) {
      this.listeners.set(knowledgeId, new Set());
    }
    this.listeners.get(knowledgeId)!.add(callback);

    return () => {
      this.listeners.get(knowledgeId)?.delete(callback);
    };
  }

  private notifyListeners(knowledgeId: string, state: ExtractState): void {
    this.listeners.get(knowledgeId)?.forEach(callback => {
      try {
        callback(state);
      } catch (e) {
        console.error('Extract listener error:', e);
      }
    });
  }

  isExtracting(knowledgeId: string): boolean {
    const state = this.getState(knowledgeId);
    return state?.status === 'extracting';
  }

  isCompleted(knowledgeId: string): boolean {
    const state = this.getState(knowledgeId);
    return state?.status === 'completed' && state.result;
  }

  updateStreamContent(knowledgeId: string, reasoningContent: string, textContent: string): void {
    this.setState(knowledgeId, { reasoningContent, textContent });
  }

  setExtracting(knowledgeId: string, params: ExtractState['extractParams'], extractId?: string): void {
    this.setState(knowledgeId, {
      status: 'extracting',
      extractParams: params,
      reasoningContent: '',
      textContent: '',
      result: null,
      extractId,
    });
  }

  setExtractId(knowledgeId: string, extractId: string): void {
    this.setState(knowledgeId, { extractId });
  }

  setCompleted(knowledgeId: string, result: any, reasoningContent?: string, textContent?: string): void {
    this.setState(knowledgeId, {
      status: 'completed',
      result,
      reasoningContent: reasoningContent || '',
      textContent: textContent || '',
    });
  }

  setInterrupted(knowledgeId: string): void {
    this.setState(knowledgeId, {
      status: 'interrupted',
      result: null,
    });
  }
}