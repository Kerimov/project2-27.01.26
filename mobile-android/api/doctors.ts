import { apiJson } from './client';

export interface Doctor {
  id: string;
  name: string;
  email: string;
  specialization: string;
  experience?: number | null;
  education?: string | null;
  phone?: string | null;
  clinic?: string | null;
  consultationFee?: number | null;
}

export interface DoctorsResponse {
  doctors: Doctor[];
}

export async function getDoctors(): Promise<Doctor[]> {
  const data = await apiJson<DoctorsResponse>('/api/doctors');
  return data.doctors;
}
