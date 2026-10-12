export interface DeviceInfo {
  phone_tag: string;
  device_model: string | null;
  last_telemetry_at: string | null;
  battery_level: number | null;
  is_charging: boolean | null;
  is_online_heuristic: boolean;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  accuracy_meters?: number | null;
  source?: string | null;
  trigger_type?: string | null;
  battery_level?: number | null;
  recorded_at: string;
  created_at?: string;
}

export type CommandType = 'ring' | 'lock' | 'locate';
export type CommandStatus = 'PENDING' | 'DELIVERED' | 'EXECUTED' | 'FAILED' | 'EXPIRED';

export interface CommandRecord {
  id: string;
  command_type: CommandType;
  status: CommandStatus;
  created_at: string;
  acknowledged_at: string | null;
  executed_at: string | null;
  expires_at?: string;
}

export interface EmergencyLoginResponse {
  status: 'success' | 'error';
  message?: string;
  emergency_token?: string;
  expires_at?: string;
  device?: {
    phone_tag: string;
    device_model: string | null;
  };
}

export interface EmergencyStatusResponse {
  status: 'success' | 'error';
  message?: string;
  device: DeviceInfo;
  latest_location: LocationData | null;
  recent_commands: CommandRecord[];
}

export interface EmergencyCommandResponse {
  status: 'success' | 'error';
  message: string;
  command?: {
    id: string;
    command_type: CommandType;
    status: CommandStatus;
    expires_at: string;
  };
}
