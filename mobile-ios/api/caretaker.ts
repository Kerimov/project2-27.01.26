import { apiJson } from './client';

export interface CarePermissions {
  analyses_read?: boolean;
  analyses_write?: boolean;
  documents_read?: boolean;
  documents_write?: boolean;
  appointments_read?: boolean;
  appointments_write?: boolean;
  reminders_read?: boolean;
  reminders_write?: boolean;
  care_plan_read?: boolean;
  care_plan_write?: boolean;
}

export interface CareRelationship {
  id: string;
  patient: {
    id: string;
    name: string;
    email: string;
  };
  caretaker: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  permissions: CarePermissions;
  createdAt: string;
}

export interface CareLinksResponse {
  asCaretaker: Array<{
    id: string;
    patient: {
      id: string;
      name: string;
      email: string;
    };
    permissions: CarePermissions;
    createdAt: string;
  }>;
  asPatient: Array<{
    id: string;
    caretaker: {
      id: string;
      name: string;
      email: string;
      role: string;
    };
    permissions: CarePermissions;
    createdAt: string;
  }>;
}

export interface CreateLinkResponse {
  link: CareRelationship;
}

export async function getCareLinks(): Promise<CareLinksResponse> {
  return await apiJson<CareLinksResponse>('/api/caretaker/links');
}

export async function createCareLink(
  caretakerEmail: string,
  permissions?: CarePermissions
): Promise<CareRelationship> {
  const data = await apiJson<CreateLinkResponse>('/api/caretaker/links', {
    method: 'POST',
    body: JSON.stringify({
      caretakerEmail,
      permissions,
    }),
  });
  return data.link;
}

export async function deleteCareLink(id: string): Promise<void> {
  await apiJson(`/api/caretaker/links/${id}`, { method: 'DELETE' });
}
