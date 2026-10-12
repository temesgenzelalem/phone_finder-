import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:uuid/uuid.dart';

void main() {
  const liveApiBase = 'https://phone-finder-api.onrender.com/api/v1';

  test('Live Render Backend: Health check returns HTTP 200', () async {
    final res = await http.get(Uri.parse('https://phone-finder-api.onrender.com/up'));
    expect(res.statusCode, equals(200));
  });

  test('Live Render Backend: Device Enrollment, Telemetry, and Emergency Login flow', () async {
    final client = http.Client();
    try {
      final testInstanceId = const Uuid().v4();
      const testRecoveryKey = 'PF-TEST-DEMO-LIVE';
      final testDeviceName = 'Integration Test Android';

      // 1. Test Device Enrollment
      final enrollRes = await client.post(
        Uri.parse('$liveApiBase/device/enroll'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: jsonEncode({
          'device_name': testDeviceName,
          'device_instance_id': testInstanceId,
          'recovery_key': testRecoveryKey,
          'fcm_token': 'fcm_mock_token_live_test',
        }),
      );

      expect(enrollRes.statusCode, equals(201),
          reason: 'Enrollment failed: ${enrollRes.body}');
      final enrollData = jsonDecode(enrollRes.body);
      expect(enrollData['status'], equals('success'));

      final phoneTag = enrollData['data']['phone_tag'] as String;
      final deviceToken = enrollData['data']['device_token'] as String;
      expect(phoneTag, startsWith('PF-'));
      expect(deviceToken, startsWith('dev_sec_'));

      // 2. Test Telemetry Upload
      final telemetryRes = await client.post(
        Uri.parse('$liveApiBase/device/telemetry'),
        headers: {
          'Authorization': 'Bearer $deviceToken',
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: jsonEncode({
          'latitude': 9.0300,
          'longitude': 38.7400,
          'accuracy_meters': 12.5,
          'battery_level': 88,
          'is_battery_charging': true,
          'trigger_type': 'HEARTBEAT',
          'recorded_at': DateTime.now().toUtc().toIso8601String(),
        }),
      );

      expect(telemetryRes.statusCode, equals(200),
          reason: 'Telemetry failed: ${telemetryRes.body}');
      final telemetryData = jsonDecode(telemetryRes.body);
      expect(telemetryData['status'], equals('success'));

      // 3. Test Emergency Login using the Recovery Key
      final loginRes = await client.post(
        Uri.parse('$liveApiBase/emergency/login'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: jsonEncode({
          'phone_tag': phoneTag,
          'recovery_key': testRecoveryKey,
        }),
      );

      expect(loginRes.statusCode, equals(200),
          reason: 'Emergency login failed: ${loginRes.body}');
      final loginData = jsonDecode(loginRes.body);
      expect(loginData['status'], equals('success'));
      expect(loginData['emergency_token'], isNotNull);

      final emergencyToken = loginData['emergency_token'] as String;

      // 4. Test Emergency Status Query
      final statusRes = await client.get(
        Uri.parse('$liveApiBase/emergency/status'),
        headers: {
          'Authorization': 'Bearer $emergencyToken',
          'Accept': 'application/json',
        },
      );

      expect(statusRes.statusCode, equals(200),
          reason: 'Emergency status failed: ${statusRes.body}');
      final statusData = jsonDecode(statusRes.body);
      expect(statusData['status'], equals('success'));
      expect(statusData['device']['phone_tag'], equals(phoneTag));
      expect(statusData['latest_location']['latitude'], closeTo(9.0300, 0.0001));

      // 5. Cleanup: Revoke Device
      final revokeRes = await client.post(
        Uri.parse('$liveApiBase/device/revoke'),
        headers: {
          'Authorization': 'Bearer $deviceToken',
          'Accept': 'application/json',
        },
      );
      expect(revokeRes.statusCode, equals(200));
    } finally {
      client.close();
    }
  });
}
