import { apiJson } from './client';

export type Sex = 'MALE' | 'FEMALE';

export interface PatientProfile {
  id: string;
  userId: string;
  sex: Sex | null;
  birthDate: string | null; // ISO date
  heightCm: number | null;
  weightKg: number | null;
  conditions: string[] | null;
  allergies: string[] | null;
  goals: string[] | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileResponse {
  profile: PatientProfile | null;
}

export interface UpdateProfileData {
  sex?: Sex | null;
  birthDate?: string | null; // ISO date
  heightCm?: number | null;
  weightKg?: number | null;
  conditions?: string[];
  allergies?: string[];
  goals?: string[];
  notes?: string | null;
}

export async function getProfile(): Promise<PatientProfile | null> {
  const data = await apiJson<ProfileResponse>('/api/profile');
  return data.profile;
}

export async function updateProfile(profileData: UpdateProfileData): Promise<PatientProfile> {
  const data = await apiJson<ProfileResponse>('/api/profile', {
    method: 'PUT',
    body: JSON.stringify(profileData),
  });
  if (!data.profile) {
    throw new Error('Профиль не найден');
  }
  return data.profile;
}
