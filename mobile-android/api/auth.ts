import { apiJson } from './client';

export type UserRole = 'PATIENT' | 'DOCTOR' | 'ADMIN' | 'CARETAKER';

export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
  role: UserRole;
}

export interface LoginResponse {
  message: string;
  token: string;
  user: AuthUser;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  return await apiJson<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function register(
  email: string,
  password: string,
  name: string
): Promise<LoginResponse> {
  return await apiJson<LoginResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
  });
}

