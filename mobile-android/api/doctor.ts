import { apiJson } from './client';

export async function getDoctorDay() {
  return apiJson<{ today?: unknown[]; tomorrow?: unknown[]; stats?: Record<string, number> }>(
    '/api/doctor/day'
  );
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
