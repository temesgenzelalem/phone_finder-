import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';
import 'onboarding_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final StorageService _storageService = StorageService();
  late final ApiService _apiService;

  String? _phoneTag;
  String? _deviceName;
  bool _isProtectionActive = true;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _apiService = ApiService(_storageService);
    _loadDeviceData();
  }

  Future<void> _loadDeviceData() async {
    final tag = await _storageService.getPhoneTag();
    final name = await _storageService.getDeviceName();
    final active = await _storageService.isProtectionActive();

    setState(() {
      _phoneTag = tag;
      _deviceName = name;
      _isProtectionActive = active;
      _isLoading = false;
    });
  }

  void _copyPhoneTag() {
    if (_phoneTag != null) {
      Clipboard.setData(ClipboardData(text: _phoneTag!));
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Phone Tag copied to clipboard!')),
      );
    }
  }

  Future<void> _toggleProtection(bool value) async {
    await _storageService.setProtectionActive(value);
    setState(() => _isProtectionActive = value);
  }

  Future<void> _confirmRevocation() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Unenroll Device?'),
        content: const Text(
          'This will revoke device protection, delete credentials from the server, and terminate all emergency sessions.',
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
            icon: const Icon(Icons.delete_forever_rounded, color: Colors.red),
            onPressed: _confirmRevocation,
            tooltip: 'Unenroll Device',
          ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Protection Status Card
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: _isProtectionActive ? Colors.green.shade50 : Colors.amber.shade50,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: _isProtectionActive ? Colors.green.shade300 : Colors.amber.shade300,
                  ),
                ),
                child: Row(
                  children: [
                    Icon(
                      _isProtectionActive ? Icons.shield_rounded : Icons.shield_outlined,
                      color: _isProtectionActive ? Colors.green.shade700 : Colors.amber.shade800,
                      size: 36,
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _isProtectionActive ? 'Protection Active' : 'Protection Paused',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: _isProtectionActive ? Colors.green.shade900 : Colors.amber.shade900,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            _isProtectionActive ? 'Listening for recovery commands' : 'Background monitoring disabled',
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
              const SizedBox(height: 20),

              // Device Identity Card
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.grey.shade200),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('DEVICE IDENTITY', style: TextStyle(fontSize: 11, color: Colors.grey.shade600, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 10),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(_deviceName ?? 'Android Device', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                        Chip(
                          label: const Text('Enrolled', style: TextStyle(fontSize: 11, color: Colors.green)),
                          backgroundColor: Colors.green.shade50,
                          padding: EdgeInsets.zero,
                        ),
                      ],
                    ),
                    const Divider(height: 24),
                    Text('EMERGENCY PHONE TAG', style: TextStyle(fontSize: 11, color: Colors.grey.shade600, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 6),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        SelectableText(
                          _phoneTag ?? 'Not Enrolled',
                          style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.blue.shade900, fontFamily: 'monospace'),
                        ),
                        IconButton(
                          icon: const Icon(Icons.copy_rounded, size: 20),
                          onPressed: _copyPhoneTag,
                          tooltip: 'Copy Phone Tag',
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              const Spacer(),

              // Web Recovery Banner
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.blue.shade50,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.blue.shade200),
                ),
                child: Row(
                  children: [
                    Icon(Icons.info_outline, color: Colors.blue.shade700, size: 20),
                    const SizedBox(width: 10),
                    const Expanded(
                      child: Text(
                        'To recover this device from a borrowed phone or PC, open the web console and enter your Phone Tag.',
                        style: TextStyle(fontSize: 12, height: 1.3),
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
    );
  }
}
