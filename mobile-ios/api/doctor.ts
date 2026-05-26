import { apiJson } from './client';

export async function getDoctorDay() {
  return apiJson<{ today?: unknown[]; tomorrow?: unknown[]; stats?: Record<string, number> }>(
    '/api/doctor/day'
  );
}

export async function createDoctorProfile(payload: {
  licenseNumber: string;
  specialization: string;
  experience: number;
  education: string;
  certifications?: string;
  phone?: string;
  clinic?: string;
  address?: string;
  consultationFee?: number | null;
  workingHours?: any;
}) {
  return apiJson('/api/doctor/profile', {
    method: 'POST',
    body: JSON.stringify(payload),
    timeoutMs: 30000,
  });
}

export async function getDoctorAppointments() {
  return apiJson<{ appointments: unknown[] }>('/api/doctor/appointments');
}

export async function getDoctorPatients() {
  return apiJson<{ patients: unknown[] }>('/api/doctor/patients');
}

export async function getDoctorPatient(id: string) {
  return apiJson<{ patient: unknown }>(`/api/doctor/patients/${id}`);
}

export async function getDoctorStats() {
  return apiJson<Record<string, number>>('/api/doctor/stats');
}
