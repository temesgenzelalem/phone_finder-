import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../services/api_service.dart';
import '../services/hardware_service.dart';
import '../services/storage_service.dart';
import 'audit_log_screen.dart';
import 'onboarding_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final StorageService _storageService = StorageService();
  final HardwareService _hardwareService = HardwareService();
  late final ApiService _apiService;

  String? _phoneTag;
  String? _deviceName;
  bool _isProtectionActive = true;
  bool _isLoading = true;
  bool _isSyncing = false;
  bool _isAlarmPlaying = false;

  int _batteryLevel = -1;
  bool _isBatteryCharging = false;
  Map<String, dynamic>? _lastLocation;

  @override
  void initState() {
    super.initState();
    _apiService = ApiService(_storageService);
    _loadAllData();
  }

  Future<void> _loadAllData() async {
    final tag = await _storageService.getPhoneTag();
    final name = await _storageService.getDeviceName();
    final active = await _storageService.isProtectionActive();
    final battery = await _hardwareService.getBatteryStatus();
    final location = await _hardwareService.getLastKnownLocation();
    final alarm = await _hardwareService.isAlarmPlaying();

    setState(() {
      _phoneTag = tag;
      _deviceName = name;
      _isProtectionActive = active;
      _batteryLevel = battery['level'] as int;
      _isBatteryCharging = battery['is_charging'] as bool;
      _lastLocation = location;
      _isAlarmPlaying = alarm;
      _isLoading = false;
    });

    if (active) {
      await _hardwareService.startForegroundProtection();
    }
  }

  void _copyPhoneTag() {
    if (_phoneTag != null) {
      Clipboard.setData(ClipboardData(text: _phoneTag!));
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Phone Tag copied to clipboard!'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<void> _toggleProtection(bool value) async {
    await _storageService.setProtectionActive(value);
    setState(() => _isProtectionActive = value);

    if (value) {
      await _hardwareService.startForegroundProtection();
    } else {
      await _hardwareService.stopForegroundProtection();
    }
  }

  Future<void> _syncTelemetryNow() async {
    setState(() => _isSyncing = true);
    try {
      final battery = await _hardwareService.getBatteryStatus();
      final location = await _hardwareService.getLastKnownLocation();

      final lat = location?['latitude'] as double? ?? 11.5972;
      final lng = location?['longitude'] as double? ?? 37.3884;
      final acc = location?['accuracy'] as double? ?? 15.0;

      await _apiService.sendTelemetry(
        latitude: lat,
        longitude: lng,
        accuracyMeters: acc,
        batteryLevel: battery['level'] as int?,
        isBatteryCharging: battery['is_charging'] as bool?,
        triggerType: 'ON_DEMAND',
        recordedAt: DateTime.now(),
      );

      setState(() {
        _batteryLevel = battery['level'] as int;
        _isBatteryCharging = battery['is_charging'] as bool;
        _lastLocation = location;
      });

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Telemetry synchronized with backend successfully.'),
          backgroundColor: Colors.green,
          behavior: SnackBarBehavior.floating,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Telemetry sync failed: $e'),
          backgroundColor: Colors.redAccent,
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      if (mounted) setState(() => _isSyncing = false);
    }
  }

  Future<void> _testSiren() async {
    if (_isAlarmPlaying) {
      await _hardwareService.stopAlarm();
      setState(() => _isAlarmPlaying = false);
    } else {
      await _hardwareService.startAlarm(durationSeconds: 5);
      if (!mounted) return;
      setState(() => _isAlarmPlaying = true);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Testing siren for 5 seconds...'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      Future.delayed(const Duration(seconds: 5), () {
        if (mounted) setState(() => _isAlarmPlaying = false);
      });
    }
  }

  Future<void> _testScreenLock() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Test Screen Lock?'),
        content: const Text(
          'This will turn off and lock your display immediately using DevicePolicyManager.lockNow().',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Lock Screen'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      try {
        await _hardwareService.lockNow();
      } catch (e) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Screen Lock Error: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  Future<void> _confirmRevocation() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Unenroll Device?'),
        content: const Text(
          'This will revoke device protection, delete credentials from the server, and terminate all active emergency sessions.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Unenroll', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      setState(() => _isLoading = true);
      try {
        await _hardwareService.stopForegroundProtection();
        await _apiService.revokeDevice();
        if (!mounted) return;
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const OnboardingScreen()),
          (route) => false,
        );
      } catch (e) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Revocation failed: $e'), backgroundColor: Colors.red),
        );
      } finally {
        if (mounted) setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      backgroundColor: Colors.grey.shade50,
      appBar: AppBar(
        title: const Text('Phone Finder', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        elevation: 0,
        foregroundColor: Colors.black87,
        actions: [
          IconButton(
            icon: const Icon(Icons.history_rounded, color: Colors.blue),
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const AuditLogScreen()),
              );
            },
            tooltip: 'Security Audit Log',
          ),
          IconButton(
            icon: const Icon(Icons.delete_forever_rounded, color: Colors.red),
            onPressed: _confirmRevocation,
            tooltip: 'Unenroll Device',
          ),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _loadAllData,
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(18.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // 1. Protection Status Toggle Card
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: _isProtectionActive ? Colors.green.shade50 : Colors.amber.shade50,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: _isProtectionActive ? Colors.green.shade300 : Colors.amber.shade300,
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        _isProtectionActive ? Icons.shield_rounded : Icons.shield_outlined,
                        color: _isProtectionActive ? Colors.green.shade700 : Colors.amber.shade800,
                        size: 34,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _isProtectionActive ? 'Protection Active' : 'Protection Paused',
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.bold,
                                color: _isProtectionActive ? Colors.green.shade900 : Colors.amber.shade900,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              _isProtectionActive
                                  ? 'Foreground service monitoring is running'
                                  : 'Tap to re-activate protection',
                              style: TextStyle(fontSize: 12, color: Colors.grey.shade700),
                            ),
                          ],
                        ),
                      ),
                      Switch(
                        value: _isProtectionActive,
                        onChanged: _toggleProtection,
                        activeThumbColor: Colors.green.shade700,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // 2. Device Identity & Emergency Phone Tag Card
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: Colors.grey.shade200),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('DEVICE NAME', style: TextStyle(fontSize: 11, color: Colors.grey.shade500, fontWeight: FontWeight.bold)),
                              const SizedBox(height: 2),
                              Text(_deviceName ?? 'Android Device', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                            ],
                          ),
                          Chip(
                            label: const Text('ENROLLED', style: TextStyle(fontSize: 10, color: Colors.green, fontWeight: FontWeight.bold)),
                            backgroundColor: Colors.green.shade50,
                            padding: EdgeInsets.zero,
                          ),
                        ],
                      ),
                      const Divider(height: 20),
                      Text('EMERGENCY PHONE TAG', style: TextStyle(fontSize: 11, color: Colors.grey.shade500, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 4),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          SelectableText(
                            _phoneTag ?? 'Not Enrolled',
                            style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.blue.shade900, fontFamily: 'monospace'),
                          ),
                          IconButton(
                            icon: const Icon(Icons.copy_rounded, color: Colors.blue, size: 20),
                            onPressed: _copyPhoneTag,
                            tooltip: 'Copy Phone Tag',
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // 3. Hardware Status Grid (Battery & Location)
                Row(
                  children: [
                    Expanded(
                      child: _buildMetricCard(
                        icon: _isBatteryCharging ? Icons.battery_charging_full_rounded : Icons.battery_std_rounded,
                        iconColor: _isBatteryCharging ? Colors.green : Colors.blue,
                        title: 'Battery',
                        value: _batteryLevel >= 0 ? '$_batteryLevel%' : 'N/A',
                        subtitle: _isBatteryCharging ? 'Charging' : 'Discharging',
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _buildMetricCard(
                        icon: Icons.my_location_rounded,
                        iconColor: Colors.deepOrange,
                        title: 'GPS Status',
                        value: _lastLocation != null ? '±${(_lastLocation!['accuracy'] as double).toStringAsFixed(0)}m' : 'Standby',
                        subtitle: _lastLocation != null ? 'Fix acquired' : 'Awaiting fix',
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // 4. Quick Hardware Self-Test Actions
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: Colors.grey.shade200),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'HARDWARE SELF-TESTS',
                        style: TextStyle(fontSize: 11, color: Colors.grey, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: _testSiren,
                              icon: Icon(_isAlarmPlaying ? Icons.stop_rounded : Icons.volume_up_rounded, size: 18),
                              label: Text(_isAlarmPlaying ? 'Stop Siren' : 'Test Siren (5s)'),
                              style: OutlinedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(vertical: 12),
                                foregroundColor: _isAlarmPlaying ? Colors.red : Colors.blue.shade700,
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: _testScreenLock,
                              icon: const Icon(Icons.lock_outline_rounded, size: 18),
                              label: const Text('Test Lock'),
                              style: OutlinedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(vertical: 12),
                                foregroundColor: Colors.black87,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton.icon(
                          onPressed: _isSyncing ? null : _syncTelemetryNow,
                          icon: _isSyncing
                              ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                              : const Icon(Icons.sync_rounded, size: 18),
                          label: Text(_isSyncing ? 'Syncing...' : 'Sync Telemetry to Server Now'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.blue.shade700,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 13),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // 5. Emergency Web Access Instructions
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Colors.blue.shade50,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.blue.shade200),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.laptop_chromebook_rounded, color: Colors.blue.shade700, size: 24),
                      const SizedBox(width: 12),
                      const Expanded(
                        child: Text(
                          'In an emergency, open the web console on any borrowed device, enter your Phone Tag and Recovery Key to locate, ring, or lock this phone.',
                          style: TextStyle(fontSize: 12, height: 1.35),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 10),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildMetricCard({
    required IconData icon,
    required Color iconColor,
    required String title,
    required String value,
    required String subtitle,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: iconColor, size: 18),
              const SizedBox(width: 6),
              Text(title, style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
            ],
          ),
          const SizedBox(height: 8),
          Text(value, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 2),
          Text(subtitle, style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
        ],
      ),
    );
  }
}
