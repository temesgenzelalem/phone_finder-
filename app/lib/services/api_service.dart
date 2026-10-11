import 'dart:convert';
import 'package:http/http.dart' as http;
import 'storage_service.dart';

class ApiService {
  final StorageService _storageService;

  ApiService(this._storageService);

  Future<String> _getBaseUrl() async {
    return await _storageService.getApiBaseUrl();
  }

  /// Enroll device with backend
  Future<Map<String, dynamic>> enrollDevice({
    required String deviceName,
    required String deviceInstanceId,
    required String recoveryKey,
    String? fcmToken,
  }) async {
    final baseUrl = await _getBaseUrl();
    final url = Uri.parse('$baseUrl/device/enroll');

    final response = await http.post(
      url,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: jsonEncode({
        'device_name': deviceName,
        'device_instance_id': deviceInstanceId,
        'recovery_key': recoveryKey,
        'fcm_token': fcmToken,
      }),
    );

    final data = jsonDecode(response.body);
    if (response.statusCode == 201) {
      return data;
    } else {
      throw Exception(data['message'] ?? 'Enrollment failed with code ${response.statusCode}');
    }
  }

  /// Report GPS location and telemetry
  Future<void> sendTelemetry({
    required double latitude,
    required double longitude,
    required double accuracyMeters,
    double? altitude,
    int? batteryLevel,
    bool? isBatteryCharging,
    required String triggerType,
    required DateTime recordedAt,
  }) async {
    final token = await _storageService.getDeviceToken();
    if (token == null) throw Exception('Device not authenticated');

    final baseUrl = await _getBaseUrl();
    final url = Uri.parse('$baseUrl/device/telemetry');

    final response = await http.post(
      url,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode({
        'latitude': latitude,
        'longitude': longitude,
        'accuracy_meters': accuracyMeters,
        'altitude': altitude,
        'battery_level': batteryLevel,
        'is_battery_charging': isBatteryCharging,
        'trigger_type': triggerType,
        'recorded_at': recordedAt.toIso8601String(),
      }),
    );

    if (response.statusCode != 200) {
      final data = jsonDecode(response.body);
      throw Exception(data['message'] ?? 'Telemetry failed');
    }
  }

  /// Acknowledge command receipt or execution
  Future<void> ackCommand({
    required String commandId,
    required String status,
    DateTime? executedAt,
    String? errorMessage,
  }) async {
    final token = await _storageService.getDeviceToken();
    if (token == null) throw Exception('Device not authenticated');

    final baseUrl = await _getBaseUrl();
    final url = Uri.parse('$baseUrl/device/commands/ack');

    final response = await http.post(
      url,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode({
        'command_id': commandId,
        'status': status,
        'executed_at': executedAt?.toIso8601String(),
        'error_message': errorMessage,
      }),
    );

    if (response.statusCode != 200) {
      final data = jsonDecode(response.body);
      throw Exception(data['message'] ?? 'Command ACK failed');
    }
  }

  /// Fetch security audit logs
  Future<List<dynamic>> getAuditLogs() async {
    final token = await _storageService.getDeviceToken();
    if (token == null) throw Exception('Device not authenticated');

    final baseUrl = await _getBaseUrl();
    final url = Uri.parse('$baseUrl/device/audit-logs');

    final response = await http.get(
      url,
      headers: {
        'Accept': 'application/json',
        'Authorization': 'Bearer $token',
      },
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return data['data'] ?? [];
    } else {
      final data = jsonDecode(response.body);
      throw Exception(data['message'] ?? 'Failed to fetch audit logs');
    }
  }

  /// Revoke and unenroll device
  Future<void> revokeDevice() async {
    final token = await _storageService.getDeviceToken();
    if (token == null) return;

    final baseUrl = await _getBaseUrl();
    final url = Uri.parse('$baseUrl/device/revoke');

    final response = await http.post(
      url,
      headers: {
        'Accept': 'application/json',
        'Authorization': 'Bearer $token',
      },
    );

    if (response.statusCode == 200) {
      await _storageService.clearAll();
    } else {
      final data = jsonDecode(response.body);
      throw Exception(data['message'] ?? 'Revocation failed');
    }
  }
}
