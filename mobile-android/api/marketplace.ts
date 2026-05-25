import { apiJson } from './client';

export interface MarketplaceCompany {
  id: string;
  name: string;
  type: string;
  description?: string;
  address: string;
  city: string;
  phone?: string;
  email?: string;
  website?: string;
  rating?: number;
  reviewCount: number;
  isVerified: boolean;
  distance?: number;
}

export async function getCompanies(params?: {
  city?: string;
  type?: string;
  search?: string;
  verified?: boolean;
}): Promise<{ companies: MarketplaceCompany[]; total: number }> {
  const q = new URLSearchParams();
  if (params?.city) q.set('city', params.city);
  if (params?.type) q.set('type', params.type);
  if (params?.search) q.set('search', params.search);
  if (params?.verified) q.set('verified', 'true');
  const query = q.toString();
  return await apiJson(`/api/marketplace/companies${query ? `?${query}` : ''}`);
}

export async function getCompany(id: string): Promise<MarketplaceCompany> {
  const data = await apiJson<MarketplaceCompany | { company: MarketplaceCompany }>(
    `/api/marketplace/companies/${id}`
  );
  return 'company' in data ? data.company : data;
}

export async function getCities(): Promise<string[]> {
  const data = await apiJson<{ cities: string[] }>('/api/marketplace/cities');
  return data.cities || [];
}

export type DiscoveredCompany = {
  id: string;
  name: string;
  type: string;
  description?: string;
  address?: string;
  city?: string;
  phone?: string;
  website?: string;
  source: 'catalog' | 'openstreetmap' | 'web';
  sourceUrl?: string;
  isVerified: boolean;
};

export type MarketplaceAISearchResult = {
  response: string;
  companies: DiscoveredCompany[];
  catalogCount: number;
  osmCount: number;
  webCount: number;
};

export async function searchMarketplaceWithAI(params: {
  message: string;
  city?: string;
  includeWeb?: boolean;
}): Promise<MarketplaceAISearchResult> {
  return await apiJson<MarketplaceAISearchResult>('/api/marketplace/ai-search', {
    method: 'POST',
    body: JSON.stringify({
      message: params.message,
      city: params.city,
      includeWeb: params.includeWeb !== false,
    }),
    timeoutMs: 45000,
  });
}
