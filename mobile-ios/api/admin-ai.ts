import { apiJson } from './client';

export type AiProviderId = 'deepseek' | 'ollama';

export type ProjectModel = {
  provider: AiProviderId;
  model: string;
  label: string;
  description: string;
  ready: boolean;
  active: boolean;
};

export type AdminAiSettingsResponse = {
  settings: {
    provider: AiProviderId;
    model: string;
    modelLabel?: string;
    source: string;
  };
  models: ProjectModel[];
  vision: { label: string; model: string; description: string; ready: boolean };
  envHints: { deepseek: boolean; ollama: boolean };
};

export function getAdminAiSettings() {
  return apiJson<AdminAiSettingsResponse>('/api/admin/ai-settings');
}

export function updateAdminAiSettings(provider: AiProviderId, model: string) {
  return apiJson<{ ok: boolean; message?: string; settings: AdminAiSettingsResponse['settings'] }>(
    '/api/admin/ai-settings',
    {
      method: 'PUT',
      body: JSON.stringify({ provider, model }),
    }
  );
}
