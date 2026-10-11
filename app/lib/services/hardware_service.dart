import 'package:flutter/services.dart';

class HardwareService {
  static const MethodChannel _channel = MethodChannel('com.phonefinder.app/hardware');

  /// Check whether Device Administrator privilege is active
  Future<bool> isDeviceAdminActive() async {
    try {
      final bool? isActive = await _channel.invokeMethod<bool>('isDeviceAdminActive');
      return isActive ?? false;
    } on PlatformException {
      return false;
    }
  }

  /// Open Android system settings to prompt the owner to activate Device Admin
  Future<void> requestDeviceAdmin() async {
    await _channel.invokeMethod('requestDeviceAdmin');
  }

  /// Lock screen immediately via DevicePolicyManager.lockNow()
  Future<bool> lockNow() async {
    try {
      final bool? success = await _channel.invokeMethod<bool>('lockNow');
      return success ?? false;
    } on PlatformException catch (e) {
      if (e.code == 'NOT_ADMIN') {
        throw Exception('Device Administrator permission is not active.');
      }
      rethrow;
    }
  }

  /// Trigger siren playback through USAGE_ALARM stream at maximum volume
  Future<void> startAlarm({int durationSeconds = 120}) async {
    await _channel.invokeMethod('startAlarm', {
      'duration_seconds': durationSeconds,
    });
  }

  /// Stop siren playback and restore previous audio volume
  Future<void> stopAlarm() async {
    await _channel.invokeMethod('stopAlarm');
  }

  /// Check if the alarm is currently sounding
  Future<bool> isAlarmPlaying() async {
    final bool? isPlaying = await _channel.invokeMethod<bool>('isAlarmPlaying');
    return isPlaying ?? false;
  }

  /// Start ongoing Location Foreground Service with persistent notification
  Future<void> startForegroundProtection() async {
    await _channel.invokeMethod('startForegroundProtection');
  }

  /// Stop ongoing Location Foreground Service
  Future<void> stopForegroundProtection() async {
    await _channel.invokeMethod('stopForegroundProtection');
  }

  /// Query native battery level and charging state
  Future<Map<String, dynamic>> getBatteryStatus() async {
    final Map<dynamic, dynamic>? result = await _channel.invokeMapMethod('getBatteryStatus');
    return {
      'level': result?['level'] as int? ?? -1,
      'is_charging': result?['is_charging'] as bool? ?? false,
    };
  }

  /// Query native cached GPS location
  Future<Map<String, dynamic>?> getLastKnownLocation() async {
    final Map<dynamic, dynamic>? result = await _channel.invokeMapMethod('getLastKnownLocation');
    if (result == null) return null;

    return {
      'latitude': result['latitude'] as double?,
      'longitude': result['longitude'] as double?,
      'accuracy': (result['accuracy'] as num?)?.toDouble(),
      'altitude': (result['altitude'] as num?)?.toDouble(),
      'time': result['time'] as int?,
    };
  }
}
