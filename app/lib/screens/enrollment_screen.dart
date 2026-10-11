import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';
import '../utils/recovery_key_generator.dart';
import 'dashboard_screen.dart';

class EnrollmentScreen extends StatefulWidget {
  const EnrollmentScreen({super.key});

  @override
  State<EnrollmentScreen> createState() => _EnrollmentScreenState();
}

class _EnrollmentScreenState extends State<EnrollmentScreen> {
  final _formKey = GlobalKey<FormState>();
  final _deviceNameController = TextEditingController(text: 'My Android Device');
  final _baseUrlController = TextEditingController(text: 'http://127.0.0.1:8000/api/v1');

  late String _recoveryKey;
  bool _hasSavedKey = false;
  bool _isLoading = false;

  final StorageService _storageService = StorageService();
  late final ApiService _apiService;

  @override
  void initState() {
    super.initState();
    _apiService = ApiService(_storageService);
    _recoveryKey = RecoveryKeyGenerator.generate();
  }

  @override
  void dispose() {
    _deviceNameController.dispose();
    _baseUrlController.dispose();
    super.dispose();
  }

  void _regenerateKey() {
    setState(() {
      _recoveryKey = RecoveryKeyGenerator.generate();
      _hasSavedKey = false;
    });
  }

  void _copyKey() {
    Clipboard.setData(ClipboardData(text: _recoveryKey));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Recovery Key copied to clipboard! Save it safely.'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  Future<void> _enrollDevice() async {
    if (!_formKey.currentState!.validate()) return;
    if (!_hasSavedKey) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please confirm that you have saved your Recovery Key before continuing.'),
          backgroundColor: Colors.redAccent,
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    setState(() => _isLoading = true);

    try {
      await _storageService.saveApiBaseUrl(_baseUrlController.text.trim());
      final instanceId = await _storageService.getDeviceInstanceId();

      final result = await _apiService.enrollDevice(
        deviceName: _deviceNameController.text.trim(),
        deviceInstanceId: instanceId,
        recoveryKey: _recoveryKey,
      );

      final data = result['data'];
      final phoneTag = data['phone_tag'];
      final deviceToken = data['device_token'];
      final deviceName = data['device_name'];

      await _storageService.savePhoneTag(phoneTag);
      await _storageService.saveDeviceToken(deviceToken);
      await _storageService.saveDeviceName(deviceName);

      if (!mounted) return;

      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (ctx) => AlertDialog(
          title: const Row(
            children: [
              Icon(Icons.check_circle, color: Colors.green),
              SizedBox(width: 10),
              Text('Device Enrolled!'),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Your phone is now actively protected.'),
              const SizedBox(height: 14),
              const Text('Assigned Phone Tag:', style: TextStyle(fontSize: 12, color: Colors.grey)),
              const SizedBox(height: 4),
              SelectableText(
                phoneTag,
                style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.blue),
              ),
              const SizedBox(height: 14),
              const Text(
                'To recover this phone in an emergency, open the web portal and enter your Phone Tag and Recovery Key.',
                style: TextStyle(fontSize: 12, height: 1.4),
              ),
            ],
          ),
          actions: [
            ElevatedButton(
              onPressed: () {
                Navigator.of(ctx).pop();
                Navigator.of(context).pushAndRemoveUntil(
                  MaterialPageRoute(builder: (_) => const DashboardScreen()),
                  (route) => false,
                );
              },
              child: const Text('Go to Protection Dashboard'),
            ),
          ],
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Enrollment Error: $e'),
          backgroundColor: Colors.redAccent,
        ),
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text('Device Enrollment', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        elevation: 0,
        foregroundColor: Colors.black87,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 12.0),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Set Up Recovery Credentials',
                  style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 6),
                Text(
                  'This recovery key is your offline master key for emergency web recovery. Keep it private.',
                  style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                ),
                const SizedBox(height: 20),

                // Device Name Field
                TextFormField(
                  controller: _deviceNameController,
                  decoration: InputDecoration(
                    labelText: 'Device Name',
                    hintText: 'e.g. Temesgen Galaxy A52',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    prefixIcon: const Icon(Icons.phone_android_rounded),
                  ),
                  validator: (val) => val == null || val.trim().isEmpty ? 'Enter a device name' : null,
                ),
                const SizedBox(height: 16),

                // API Base URL Field (with ADB reverse note)
                TextFormField(
                  controller: _baseUrlController,
                  decoration: InputDecoration(
                    labelText: 'Backend API URL',
                    hintText: 'http://127.0.0.1:8000/api/v1',
                    helperText: 'For physical phone via USB, run "adb reverse tcp:8000 tcp:8000"',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    prefixIcon: const Icon(Icons.dns_rounded),
                  ),
                  validator: (val) => val == null || val.trim().isEmpty ? 'Enter API URL' : null,
                ),
                const SizedBox(height: 24),

                // Recovery Key Card
                Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: Colors.blue.shade900,
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.blue.shade900.withValues(alpha: 0.2),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Column(
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Row(
                            children: [
                              Icon(Icons.vpn_key_rounded, color: Colors.amber, size: 20),
                              SizedBox(width: 8),
                              Text(
                                'OFFLINE RECOVERY KEY',
                                style: TextStyle(
                                  color: Colors.white70,
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                  letterSpacing: 1.1,
                                ),
                              ),
                            ],
                          ),
                          IconButton(
                            icon: const Icon(Icons.refresh_rounded, color: Colors.white70, size: 20),
                            onPressed: _regenerateKey,
                            tooltip: 'Regenerate key',
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      SelectableText(
                        _recoveryKey,
                        style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 1.5,
                          color: Colors.white,
                          fontFamily: 'monospace',
                        ),
                      ),
                      const SizedBox(height: 14),
                      TextButton.icon(
                        onPressed: _copyKey,
                        icon: const Icon(Icons.copy_rounded, size: 16, color: Colors.white),
                        label: const Text('Copy Recovery Key', style: TextStyle(color: Colors.white)),
                        style: TextButton.styleFrom(
                          backgroundColor: Colors.white.withValues(alpha: 0.15),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // Confirmation Checkbox
                Container(
                  decoration: BoxDecoration(
                    color: Colors.amber.shade50,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.amber.shade300),
                  ),
                  child: CheckboxListTile(
                    value: _hasSavedKey,
                    onChanged: (val) => setState(() => _hasSavedKey = val ?? false),
                    title: const Text(
                      'I have safely recorded this recovery key.',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.brown),
                    ),
                    subtitle: const Text(
                      'This key cannot be recovered if your phone is lost.',
                      style: TextStyle(fontSize: 11, color: Colors.brown),
                    ),
                    controlAffinity: ListTileControlAffinity.leading,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 8),
                  ),
                ),
                const SizedBox(height: 24),

                // Activate Button
                ElevatedButton(
                  onPressed: _isLoading ? null : _enrollDevice,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.blue.shade700,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    elevation: 0,
                  ),
                  child: _isLoading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                        )
                      : const Text(
                          'Activate Device Protection',
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                        ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
