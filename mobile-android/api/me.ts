import { apiJson } from './client';
import type { AuthUser } from './auth';

export interface MeResponse {
  user: AuthUser;
}

export async function me(): Promise<MeResponse> {
  return await apiJson<MeResponse>('/api/auth/me');
}

