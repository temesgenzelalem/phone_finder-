import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';

class AuditLogScreen extends StatefulWidget {
  const AuditLogScreen({super.key});

  @override
  State<AuditLogScreen> createState() => _AuditLogScreenState();
}

class _AuditLogScreenState extends State<AuditLogScreen> {
  final StorageService _storageService = StorageService();
  late final ApiService _apiService;

  List<dynamic> _logs = [];
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _apiService = ApiService(_storageService);
    _fetchAuditLogs();
  }

  Future<void> _fetchAuditLogs() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final logs = await _apiService.getAuditLogs();
      setState(() {
        _logs = logs;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = e.toString();
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey.shade50,
      appBar: AppBar(
        title: const Text('Security Audit Log', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black87,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _fetchAuditLogs,
            tooltip: 'Refresh Logs',
          ),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _fetchAuditLogs,
          child: _buildBody(),
        ),
      ),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_errorMessage != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline_rounded, color: Colors.red, size: 48),
              const SizedBox(height: 12),
              Text(
                'Could not load audit logs',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
              ),
              const SizedBox(height: 6),
              Text(
                _errorMessage!,
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
              ),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: _fetchAuditLogs,
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    if (_logs.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.history_rounded, size: 48, color: Colors.grey.shade400),
            const SizedBox(height: 12),
            Text(
              'No security events recorded yet',
              style: TextStyle(color: Colors.grey.shade600, fontSize: 14),
            ),
          ],
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      itemCount: _logs.length,
      separatorBuilder: (_, _) => const SizedBox(height: 10),
      itemBuilder: (context, index) {
        final log = _logs[index];
        final eventType = log['event_type'] as String? ?? 'UNKNOWN';
        final ipAddress = log['ip_address'] as String? ?? 'N/A';
        final createdAt = log['created_at'] as String? ?? '';
        final details = log['details'] as Map<String, dynamic>? ?? {};

        return _buildAuditItem(
          eventType: eventType,
          ipAddress: ipAddress,
          timestamp: createdAt,
          details: details,
        );
      },
    );
  }

  Widget _buildAuditItem({
    required String eventType,
    required String ipAddress,
    required String timestamp,
    required Map<String, dynamic> details,
  }) {
    final badgeConfig = _getBadgeConfig(eventType);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: badgeConfig.color.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: Icon(badgeConfig.icon, color: badgeConfig.color, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      badgeConfig.title,
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                    ),
                    Text(
                      _formatDate(timestamp),
                      style: TextStyle(fontSize: 11, color: Colors.grey.shade500),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  badgeConfig.subtitle(details, ipAddress),
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade700, height: 1.3),
                ),
                const SizedBox(height: 4),
                Text(
                  'IP: $ipAddress',
                  style: TextStyle(fontSize: 11, color: Colors.grey.shade500, fontFamily: 'monospace'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  _AuditBadgeConfig _getBadgeConfig(String eventType) {
    switch (eventType) {
      case 'ENROLL':
        return _AuditBadgeConfig(
          title: 'Device Enrolled',
          color: Colors.blue.shade700,
          icon: Icons.app_registration_rounded,
          subtitle: (d, ip) => 'Initial setup and credential generation completed.',
        );
      case 'AUTH_SUCCESS':
        return _AuditBadgeConfig(
          title: 'Emergency Web Login',
          color: Colors.green.shade700,
          icon: Icons.check_circle_rounded,
          subtitle: (d, ip) => 'Emergency session authorized via Recovery Key.',
        );
      case 'AUTH_FAIL':
        return _AuditBadgeConfig(
          title: 'Failed Emergency Login',
          color: Colors.red.shade700,
          icon: Icons.warning_amber_rounded,
          subtitle: (d, ip) => 'Invalid Recovery Key attempted (${d['failed_attempts'] ?? 1} failures).',
        );
      case 'CMD_DISPATCH':
      case 'CMD_DISPATCHED':
        return _AuditBadgeConfig(
          title: 'Command Dispatched',
          color: Colors.orange.shade700,
          icon: Icons.send_rounded,
          subtitle: (d, ip) => 'Remote command issued: ${d['command_type'] ?? 'COMMAND'}.',
        );
      case 'CMD_ACK':
        return _AuditBadgeConfig(
          title: 'Command Executed',
          color: Colors.teal.shade700,
          icon: Icons.task_alt_rounded,
          subtitle: (d, ip) => 'Command ${d['command_type'] ?? ''} status: ${d['status'] ?? 'ACK'}.',
        );
      case 'LOGOUT':
        return _AuditBadgeConfig(
          title: 'Emergency Session Ended',
          color: Colors.blueGrey.shade700,
          icon: Icons.logout_rounded,
          subtitle: (d, ip) => 'Web recovery session explicitly terminated.',
        );
      case 'REVOKE':
        return _AuditBadgeConfig(
          title: 'Device Revoked',
          color: Colors.red.shade900,
          icon: Icons.delete_forever_rounded,
          subtitle: (d, ip) => 'Device unenrollment executed.',
        );
      default:
        return _AuditBadgeConfig(
          title: eventType,
          color: Colors.grey.shade700,
          icon: Icons.info_outline_rounded,
          subtitle: (d, ip) => 'Event recorded.',
        );
    }
  }

  String _formatDate(String isoString) {
    if (isoString.isEmpty) return '';
    try {
      final dt = DateTime.parse(isoString).toLocal();
      final now = DateTime.now();
      final diff = now.difference(dt);

      if (diff.inMinutes < 1) return 'Just now';
      if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
      if (diff.inHours < 24) return '${diff.inHours}h ago';
      return '${dt.month}/${dt.day} ${dt.hour}:${dt.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return isoString;
    }
  }
}

class _AuditBadgeConfig {
  final String title;
  final Color color;
  final IconData icon;
  final String Function(Map<String, dynamic> details, String ip) subtitle;

  _AuditBadgeConfig({
    required this.title,
    required this.color,
    required this.icon,
    required this.subtitle,
  });
}
