import { apiJson } from './client';

export type AppointmentStatus =
  | 'scheduled'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export type AppointmentType = 'consultation' | 'follow_up' | 'emergency' | 'routine';

export interface DoctorInfo {
  id: string;
  name: string;
  email: string;
  specialization?: string;
}

export interface Appointment {
  id: string;
  doctorId: string;
  patientId: string;
  patientName: string;
  patientPhone?: string | null;
  patientEmail?: string | null;
  appointmentType: AppointmentType;
  scheduledAt: string; // ISO date
  duration: number;
  status: AppointmentStatus;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  doctor: {
    id: string;
    user: {
      name: string;
      email: string;
    };
    specialization?: string;
  };
  preVisit?: {
    id: string;
    submittedAt?: string | null;
    updatedAt: string;
  } | null;
}

export interface AppointmentsResponse {
  appointments: Appointment[];
}

export interface AppointmentResponse {
  message: string;
  appointment: Appointment;
}

export interface AvailableSlot {
  time: string; // ISO date
  timeString: string; // "HH:mm"
  available: boolean;
}

export interface AvailableSlotsResponse {
  doctor: {
    id: string;
    name: string;
    email: string;
    specialization?: string;
  };
  date: string; // ISO date
  availableSlots: AvailableSlot[];
}

export async function getAppointments(): Promise<Appointment[]> {
  const data = await apiJson<AppointmentsResponse>('/api/appointments');
  return data.appointments;
}

export async function createAppointment(
  doctorId: string,
  scheduledAt: string, // ISO date
  options?: {
    appointmentType?: AppointmentType;
    notes?: string;
  }
): Promise<Appointment> {
  const data = await apiJson<AppointmentResponse>('/api/appointments', {
    method: 'POST',
    body: JSON.stringify({
      doctorId,
      scheduledAt,
      appointmentType: options?.appointmentType || 'consultation',
      notes: options?.notes || null,
    }),
  });
  return data.appointment;
}

export async function updateAppointment(
  id: string,
  status: AppointmentStatus,
  scheduledAt?: string // ISO date for rescheduling
): Promise<Appointment> {
  const data = await apiJson<{ success: boolean; appointment: Appointment }>(
    `/api/appointments/${id}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        status,
        scheduledAt,
      }),
    }
  );
  return data.appointment;
}

export async function getAvailableSlots(
  doctorId: string,
  date: string // YYYY-MM-DD format
): Promise<AvailableSlotsResponse> {
  return await apiJson<AvailableSlotsResponse>(
    `/api/appointments/available-slots?doctorId=${doctorId}&date=${date}`
  );
}
