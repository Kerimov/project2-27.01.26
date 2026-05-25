import { apiJson } from './client';

export interface PatientMedication {
  id: string;
  userId: string;
  name: string;
  dosage?: string | null;
  form?: string | null;
  route?: string | null;
  frequencyPerDay?: number | null;
  times?: string[] | null; // ["08:00", "20:00"]
  startDate?: string | null; // ISO date
  endDate?: string | null; // ISO date
  notes?: string | null;
  isSupplement: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MedicationsResponse {
  medications: PatientMedication[];
}

export interface MedicationResponse {
  medication: PatientMedication;
}

export interface CreateMedicationData {
  name: string;
  dosage?: string;
  form?: string;
  route?: string;
  frequencyPerDay?: number;
  times?: string[];
  startDate?: string; // ISO date
  endDate?: string; // ISO date
  notes?: string;
  isSupplement?: boolean;
  patientId?: string;
}

export interface UpdateMedicationData {
  name?: string;
  dosage?: string;
  form?: string;
  route?: string;
  frequencyPerDay?: number;
  times?: string[];
  startDate?: string; // ISO date
  endDate?: string; // ISO date
  notes?: string;
  isSupplement?: boolean;
}

export async function getMedications(patientId?: string): Promise<PatientMedication[]> {
  const url = patientId ? `/api/medications?patientId=${patientId}` : '/api/medications';
  const data = await apiJson<MedicationsResponse>(url);
  return data.medications;
}

export async function createMedication(
  medicationData: CreateMedicationData
): Promise<PatientMedication> {
  const data = await apiJson<MedicationResponse>('/api/medications', {
    method: 'POST',
    body: JSON.stringify(medicationData),
  });
  return data.medication;
}

export async function updateMedication(
  id: string,
  medicationData: UpdateMedicationData,
  patientId?: string
): Promise<PatientMedication> {
  const url = patientId ? `/api/medications/${id}?patientId=${patientId}` : `/api/medications/${id}`;
  const data = await apiJson<MedicationResponse>(url, {
    method: 'PUT',
    body: JSON.stringify(medicationData),
  });
  return data.medication;
}

export async function deleteMedication(id: string, patientId?: string): Promise<void> {
  const url = patientId ? `/api/medications/${id}?patientId=${patientId}` : `/api/medications/${id}`;
  await apiJson(url, { method: 'DELETE' });
}
