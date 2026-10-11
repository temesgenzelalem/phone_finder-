import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';
import 'enrollment_screen.dart';

class PermissionMatrixScreen extends StatefulWidget {
  const PermissionMatrixScreen({super.key});

  @override
  State<PermissionMatrixScreen> createState() => _PermissionMatrixScreenState();
}

class _PermissionMatrixScreenState extends State<PermissionMatrixScreen> with WidgetsBindingObserver {
  bool _locationGranted = false;
  bool _notificationGranted = false;
  bool _batteryExempted = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _checkPermissions();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _checkPermissions();
    }
  }

  Future<void> _checkPermissions() async {
    final locStatus = await Permission.locationWhenInUse.status;
    final notifStatus = await Permission.notification.status;
    final batteryStatus = await Permission.ignoreBatteryOptimizations.status;

    setState(() {
      _locationGranted = locStatus.isGranted;
      _notificationGranted = notifStatus.isGranted;
      _batteryExempted = batteryStatus.isGranted;
    });
  }

  Future<void> _requestLocation() async {
    final status = await Permission.locationWhenInUse.request();
    setState(() => _locationGranted = status.isGranted);
  }

  Future<void> _requestNotification() async {
    final status = await Permission.notification.request();
    setState(() => _notificationGranted = status.isGranted);
  }

  Future<void> _requestBatteryOptimization() async {
    final status = await Permission.ignoreBatteryOptimizations.request();
    setState(() => _batteryExempted = status.isGranted);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text('Permissions & Safety', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        elevation: 0,
        foregroundColor: Colors.black87,
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 12.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Required Device Permissions',
                style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Text(
                'Phone Finder operates with complete transparency. We request only the capabilities required to locate and secure your lost device.',
                style: TextStyle(color: Colors.grey.shade600, fontSize: 13, height: 1.4),
              ),
              const SizedBox(height: 20),

              Expanded(
                child: ListView(
                  children: [
                    _buildPermissionItem(
                      icon: Icons.location_on_rounded,
                      title: 'Location Service',
                      description: 'Required to report GPS coordinates during emergency recovery.',
                      isGranted: _locationGranted,
                      onPressed: _requestLocation,
                    ),
                    const SizedBox(height: 14),
                    _buildPermissionItem(
                      icon: Icons.notifications_active_rounded,
                      title: 'Persistent Notification',
                      description: 'Maintains an ongoing foreground status so tracking is never hidden.',
                      isGranted: _notificationGranted,
                      onPressed: _requestNotification,
                    ),
                    const SizedBox(height: 14),
                    _buildPermissionItem(
                      icon: Icons.battery_charging_full_rounded,
                      title: 'Battery Optimization Exemption',
                      description: 'Prevents Android Doze from abruptly killing the emergency listener.',
                      isGranted: _batteryExempted,
                      onPressed: _requestBatteryOptimization,
                    ),
                    const SizedBox(height: 14),
                    _buildPermissionItem(
                      icon: Icons.admin_panel_settings_rounded,
                      title: 'Device Administration',
                      description: 'Authorizes DevicePolicyManager.lockNow() to lock screen on demand.',
                      isGranted: true, // Native receiver handles policy activation in Milestone 5
                      onPressed: null,
                      infoTag: 'Active in Engine',
                    ),
                  ],
                ),
              ),

              ElevatedButton(
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => const EnrollmentScreen(),
                    ),
                  );
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.blue.shade700,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  elevation: 0,
                ),
                child: const Text(
                  'Continue to Enrollment',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
              ),
              const SizedBox(height: 8),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPermissionItem({
    required IconData icon,
    required String title,
    required String description,
    required bool isGranted,
    required VoidCallback? onPressed,
    String? infoTag,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isGranted ? Colors.blue.shade50.withValues(alpha: 0.3) : Colors.grey.shade50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isGranted ? Colors.blue.shade200 : Colors.grey.shade300,
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: isGranted ? Colors.blue.shade700 : Colors.grey.shade600, size: 26),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                ),
                const SizedBox(height: 4),
                Text(
                  description,
                  style: TextStyle(color: Colors.grey.shade600, fontSize: 12, height: 1.3),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          if (infoTag != null)
            Chip(
              label: Text(infoTag, style: const TextStyle(fontSize: 10, color: Colors.blue)),
              backgroundColor: Colors.blue.shade50,
              padding: EdgeInsets.zero,
            )
          else if (isGranted)
            const Icon(Icons.check_circle_rounded, color: Colors.green, size: 26)
          else
            TextButton(
              onPressed: onPressed,
              style: TextButton.styleFrom(
                backgroundColor: Colors.blue.shade700,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              child: const Text('Grant', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
            ),
        ],
      ),
    );
  }
}
