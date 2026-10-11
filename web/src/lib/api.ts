import {
  EmergencyLoginResponse,
  EmergencyStatusResponse,
  EmergencyCommandResponse,
  CommandType,
} from '@/types/emergency';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export async function loginEmergency(
  phoneTag: string,
  recoveryKey: string
): Promise<EmergencyLoginResponse> {
  const normalizedTag = phoneTag.trim().toUpperCase();
  const normalizedKey = recoveryKey.trim().toUpperCase();

  const response = await fetch(`${BASE_URL}/api/v1/emergency/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      phone_tag: normalizedTag,
      recovery_key: normalizedKey,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(
      data.message || 'Authentication failed. Please verify your Phone Tag and Recovery Key.',
      response.status,
      data
    );
  }

  return data as EmergencyLoginResponse;
}

export async function getEmergencyStatus(
  token: string
): Promise<EmergencyStatusResponse> {
  const response = await fetch(`${BASE_URL}/api/v1/emergency/status`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(
      data.message || 'Failed to fetch emergency status.',
      response.status,
      data
    );
  }

  return data as EmergencyStatusResponse;
}

export async function sendEmergencyCommand(
  token: string,
  commandType: CommandType
): Promise<EmergencyCommandResponse> {
  const response = await fetch(`${BASE_URL}/api/v1/emergency/command`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      command_type: commandType,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(
      data.message || `Failed to dispatch command: ${commandType}`,
      response.status,
      data
    );
  }

  return data as EmergencyCommandResponse;
}

export async function logoutEmergency(token: string): Promise<void> {
  try {
    await fetch(`${BASE_URL}/api/v1/emergency/logout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
  } catch (error) {
    // Session logout error can be silently absorbed on client
    console.warn('Logout network error:', error);
  }
}
