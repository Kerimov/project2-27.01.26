import { apiJson } from './client';

export interface PreVisitAnswers {
  goal?: string;
  complaints?: string;
  duration?: string;
  vitals?: string;
  currentMedications?: string;
  allergies?: string;
  chronicConditions?: string;
  questionsForDoctor?: string;
  otherNotes?: string;
}

export interface PreVisitQuestionnaire {
  id: string;
  appointmentId: string;
  patientId: string;
  doctorId: string;
  answers: PreVisitAnswers;
  submittedAt?: string | null; // ISO date
  createdAt: string;
  updatedAt: string;
}

export interface PreVisitResponse {
  questionnaire: PreVisitQuestionnaire | null;
}

export interface UpdatePreVisitData {
  answers: PreVisitAnswers;
  submitted?: boolean;
}

export async function getPreVisitQuestionnaire(
  appointmentId: string
): Promise<PreVisitQuestionnaire | null> {
  const data = await apiJson<PreVisitResponse>(`/api/appointments/${appointmentId}/previsit`);
  return data.questionnaire;
}

export async function updatePreVisitQuestionnaire(
  appointmentId: string,
  updateData: UpdatePreVisitData
): Promise<PreVisitQuestionnaire> {
  const data = await apiJson<PreVisitResponse>(`/api/appointments/${appointmentId}/previsit`, {
    method: 'PUT',
    body: JSON.stringify(updateData),
  });
  if (!data.questionnaire) {
    throw new Error('Анкета не найдена');
  }
  return data.questionnaire;
}

export interface GenerateDoctorReportResponse {
  documentId: string;
}

export async function generateDoctorReport(
  appointmentId: string
): Promise<string> {
  const data = await apiJson<GenerateDoctorReportResponse>('/api/reports/doctor-summary', {
    method: 'POST',
    body: JSON.stringify({ appointmentId }),
  });
  return data.documentId;
}
