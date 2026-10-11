import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';

class StorageService {
  static const _keyInstanceId = 'device_instance_id';
  static const _keyDeviceToken = 'device_token';
  static const _keyPhoneTag = 'phone_tag';
  static const _keyDeviceName = 'device_name';
  static const _keyApiBaseUrl = 'api_base_url';
  static const _keyProtectionActive = 'is_protection_active';

  final FlutterSecureStorage _secureStorage = const FlutterSecureStorage();

  /// Get or generate unique persistent device instance UUID
  Future<String> getDeviceInstanceId() async {
    String? instanceId = await _secureStorage.read(key: _keyInstanceId);
    if (instanceId == null || instanceId.isEmpty) {
      instanceId = const Uuid().v4();
      await _secureStorage.write(key: _keyInstanceId, value: instanceId);
    }
    return instanceId;
  }

  /// Save authentication device token (dev_sec_...)
  Future<void> saveDeviceToken(String token) async {
    await _secureStorage.write(key: _keyDeviceToken, value: token);
  }

  Future<String?> getDeviceToken() async {
    return await _secureStorage.read(key: _keyDeviceToken);
  }

  Future<void> savePhoneTag(String tag) async {
    await _secureStorage.write(key: _keyPhoneTag, value: tag);
  }

  Future<String?> getPhoneTag() async {
    return await _secureStorage.read(key: _keyPhoneTag);
  }

  Future<void> saveDeviceName(String name) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyDeviceName, name);
  }

  Future<String?> getDeviceName() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_keyDeviceName);
  }

  Future<void> saveApiBaseUrl(String url) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyApiBaseUrl, url);
  }

  Future<String> getApiBaseUrl() async {
    final prefs = await SharedPreferences.getInstance();
    const defaultUrl = String.fromEnvironment(
      'API_BASE_URL',
      defaultValue: 'http://127.0.0.1:8000/api/v1',
    );
    return prefs.getString(_keyApiBaseUrl) ?? defaultUrl;
  }

  Future<void> setProtectionActive(bool active) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_keyProtectionActive, active);
  }

  Future<bool> isProtectionActive() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_keyProtectionActive) ?? true;
  }

  /// Check whether device is currently enrolled
  Future<bool> isEnrolled() async {
    final token = await getDeviceToken();
    final tag = await getPhoneTag();
    return token != null && token.isNotEmpty && tag != null && tag.isNotEmpty;
  }

  /// Clean wipe upon revocation / unenrollment
  Future<void> clearAll() async {
    await _secureStorage.deleteAll();
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
  }
}
