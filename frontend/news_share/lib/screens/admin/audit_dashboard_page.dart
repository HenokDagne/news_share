import 'package:flutter/material.dart';
import 'package:news_share/models/audit_models.dart';
import 'package:news_share/services/audit_service.dart';

class AuditDashboardPage extends StatefulWidget {
  const AuditDashboardPage({super.key});

  @override
  State<AuditDashboardPage> createState() => _AuditDashboardPageState();
}

class _AuditDashboardPageState extends State<AuditDashboardPage> with SingleTickerProviderStateMixin {
  final _auditService = AuditService.instance;
  late TabController _tabController;

  bool _isLoading = true;
  String? _errorMessage;

  AuditDashboardModel? _dashboard;
  List<AuditLogModel> _logs = [];
  List<SecurityAlertModel> _alerts = [];
  IntegrityCheckReportModel? _integrityReport;
  bool _isVerifyingIntegrity = false;

  String _selectedCategory = 'ALL';
  String _selectedSeverity = 'ALL';
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _loadAllData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadAllData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final dashboard = await _auditService.getDashboard();
      final logs = await _auditService.getAuditLogs(
        category: _selectedCategory == 'ALL' ? null : _selectedCategory,
        severity: _selectedSeverity == 'ALL' ? null : _selectedSeverity,
        action: _searchController.text.trim().isEmpty ? null : _searchController.text.trim(),
        decrypt: true,
      );
      final alerts = await _auditService.getAlerts();

      if (mounted) {
        setState(() {
          _dashboard = dashboard;
          _logs = logs;
          _alerts = alerts;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString();
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _runIntegrityCheck() async {
    setState(() {
      _isVerifyingIntegrity = true;
    });
    try {
      final report = await _auditService.verifyLogIntegrity();
      if (mounted) {
        setState(() {
          _integrityReport = report;
          _isVerifyingIntegrity = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: report.isValid ? const Color(0xFF43A047) : const Color(0xFFE53935),
            content: Text(
              report.isValid
                ? 'Integrity Verified: All ${report.totalRecordsVerified} records intact with valid cryptographic chaining.'
                : 'ALERT: Tampering detected! ${report.tamperedRecord?['reason'] ?? ''}',
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isVerifyingIntegrity = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to verify integrity: $e')),
        );
      }
    }
  }

  Future<void> _acknowledgeAlert(String id) async {
    try {
      await _auditService.acknowledgeAlert(id);
      await _loadAllData();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error acknowledging alert: $e')),
        );
      }
    }
  }

  Future<void> _showResolveDialog(String id) async {
    final notesController = TextEditingController();
    await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Resolve Security Alert'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Document resolution notes and corrective actions taken:',
              style: TextStyle(fontSize: 13, color: Colors.black87),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: notesController,
              maxLines: 3,
              decoration: const InputDecoration(
                hintText: 'e.g. Blocked offending IP on firewall, notified user...',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0095F6)),
            onPressed: () async {
              final notes = notesController.text.trim();
              if (notes.isEmpty) return;
              Navigator.pop(ctx);
              try {
                await _auditService.resolveAlert(id, notes);
                await _loadAllData();
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Error resolving alert: $e')),
                  );
                }
              }
            },
            child: const Text('Resolve', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  Color _getSeverityColor(String severity) {
    switch (severity.toUpperCase()) {
      case 'CRITICAL':
        return const Color(0xFFD32F2F);
      case 'HIGH':
        return const Color(0xFFE53935);
      case 'MEDIUM':
        return const Color(0xFFFB8C00);
      case 'LOW':
        return const Color(0xFFFDD835);
      default:
        return const Color(0xFF1E88E5);
    }
  }

  Widget _buildMetricCard(String title, String value, IconData icon, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE0E0E0)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.03),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(title, style: const TextStyle(fontSize: 12, color: Color(0xFF757575), fontWeight: FontWeight.w500)),
                Icon(icon, size: 18, color: color),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              value,
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: color),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildIntegrityBanner() {
    final report = _integrityReport;
    final isChecked = report != null;
    final isValid = isChecked && report.isValid;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: !isChecked
            ? const Color(0xFFF5F5F5)
            : (isValid ? const Color(0xFFE8F5E9) : const Color(0xFFFFEBEE)),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: !isChecked
              ? const Color(0xFFE0E0E0)
              : (isValid ? const Color(0xFF43A047) : const Color(0xFFE53935)),
        ),
      ),
      child: Row(
        children: [
          Icon(
            !isChecked
                ? Icons.shield_outlined
                : (isValid ? Icons.verified_user_rounded : Icons.gpp_bad_rounded),
            color: !isChecked
                ? const Color(0xFF757575)
                : (isValid ? const Color(0xFF43A047) : const Color(0xFFE53935)),
            size: 28,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  !isChecked
                      ? 'Tamper-Evident Cryptographic Integrity'
                      : (isValid ? 'Cryptographic Integrity Verified' : 'CRITICAL: Hash Chain Tampering Detected!'),
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: !isChecked
                        ? Colors.black87
                        : (isValid ? const Color(0xFF2E7D32) : const Color(0xFFC62828)),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  !isChecked
                      ? 'Verify SHA-256 hash chaining to ensure no audit logs were altered or deleted.'
                      : (isValid
                          ? '${report.totalRecordsVerified} records verified sequentially. Chain unbroken.'
                          : (report.tamperedRecord?['reason'] ?? 'Log integrity mismatch detected.')),
                  style: const TextStyle(fontSize: 12, color: Color(0xFF616161)),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF0095F6),
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: _isVerifyingIntegrity ? null : _runIntegrityCheck,
            icon: _isVerifyingIntegrity
                ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Icon(Icons.check_circle_outline, size: 16, color: Colors.white),
            label: Text(
              _isVerifyingIntegrity ? 'Checking...' : 'Verify Chain',
              style: const TextStyle(fontSize: 12, color: Colors.white),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAuditLogsTab() {
    return Column(
      children: [
        // Filter bar
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _searchController,
                  decoration: InputDecoration(
                    hintText: 'Search action (e.g. AUTH_LOGIN)...',
                    prefixIcon: const Icon(Icons.search, size: 20),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  onSubmitted: (_) => _loadAllData(),
                ),
              ),
              const SizedBox(width: 8),
              IconButton(
                icon: const Icon(Icons.refresh),
                onPressed: _loadAllData,
              ),
            ],
          ),
        ),
        Expanded(
          child: _logs.isEmpty
              ? const Center(child: Text('No audit records matching query.'))
              : ListView.separated(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  itemCount: _logs.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (context, index) {
                    final log = _logs[index];
                    final severityColor = _getSeverityColor(log.severity);

                    return Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFEEEEEE)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(
                                  color: severityColor.withOpacity(0.12),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  log.action,
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.bold,
                                    color: severityColor,
                                  ),
                                ),
                              ),
                              Text(
                                log.timestamp.toLocal().toString().split('.')[0],
                                style: const TextStyle(fontSize: 11, color: Color(0xFF9E9E9E)),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              const Icon(Icons.person_outline, size: 14, color: Color(0xFF757575)),
                              const SizedBox(width: 4),
                              Text(
                                log.username ?? 'Anonymous',
                                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                              ),
                              const SizedBox(width: 14),
                              const Icon(Icons.location_on_outlined, size: 14, color: Color(0xFF757575)),
                              const SizedBox(width: 4),
                              Text(
                                log.ipAddress ?? 'N/A',
                                style: const TextStyle(fontSize: 12, color: Color(0xFF616161)),
                              ),
                              if (log.statusCode != null) ...[
                                const Spacer(),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: log.statusCode! < 400 ? const Color(0xFFE8F5E9) : const Color(0xFFFFEBEE),
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: Text(
                                    'HTTP ${log.statusCode}',
                                    style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.bold,
                                      color: log.statusCode! < 400 ? const Color(0xFF2E7D32) : const Color(0xFFC62828),
                                    ),
                                  ),
                                ),
                              ],
                            ],
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'Hash: ${log.recordHash.substring(0, 16)}... (Seq #${log.sequenceNumber})',
                            style: const TextStyle(fontSize: 10, fontFamily: 'monospace', color: Color(0xFF9E9E9E)),
                          ),
                        ],
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }

  Widget _buildAlertsTab() {
    return _alerts.isEmpty
        ? const Center(child: Text('No active security alerts. All systems healthy.'))
        : ListView.separated(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            itemCount: _alerts.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (context, index) {
              final alert = _alerts[index];
              final severityColor = _getSeverityColor(alert.severity);
              final isOpen = alert.status == 'OPEN';

              return Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: isOpen ? severityColor.withOpacity(0.5) : const Color(0xFFEEEEEE),
                    width: isOpen ? 1.5 : 1.0,
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Icon(Icons.warning_amber_rounded, size: 18, color: severityColor),
                            const SizedBox(width: 6),
                            Text(
                              alert.alertType,
                              style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: severityColor),
                            ),
                          ],
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: isOpen ? const Color(0xFFFFEBEE) : const Color(0xFFE8F5E9),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            alert.status,
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: isOpen ? const Color(0xFFC62828) : const Color(0xFF2E7D32),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(alert.title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 4),
                    Text(alert.description, style: const TextStyle(fontSize: 12, color: Color(0xFF616161))),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          alert.timestamp.toLocal().toString().split('.')[0],
                          style: const TextStyle(fontSize: 11, color: Color(0xFF9E9E9E)),
                        ),
                        Row(
                          children: [
                            if (isOpen)
                              TextButton(
                                onPressed: () => _acknowledgeAlert(alert.id),
                                child: const Text('Acknowledge'),
                              ),
                            if (alert.status != 'RESOLVED')
                              ElevatedButton(
                                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0095F6)),
                                onPressed: () => _showResolveDialog(alert.id),
                                child: const Text('Resolve', style: TextStyle(color: Colors.white, fontSize: 12)),
                              ),
                          ],
                        ),
                      ],
                    ),
                  ],
                ),
              );
            },
          );
  }

  Widget _buildRetentionTab() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Centralized Logging & SIEM Export', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 6),
          const Text(
            'Export tamper-evident audit logs to central SIEM solutions (Splunk, Elastic, Datadog, CEF).',
            style: TextStyle(fontSize: 13, color: Color(0xFF616161)),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0095F6)),
                onPressed: () async {
                  await _auditService.exportLogs(format: 'json');
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Successfully exported audit logs in JSON format.')),
                    );
                  }
                },
                icon: const Icon(Icons.download_rounded, color: Colors.white, size: 18),
                label: const Text('Export SIEM JSON', style: TextStyle(color: Colors.white)),
              ),
              const SizedBox(width: 12),
              OutlinedButton.icon(
                onPressed: () async {
                  await _auditService.exportLogs(format: 'cef');
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Successfully exported audit logs in ArcSight CEF format.')),
                    );
                  }
                },
                icon: const Icon(Icons.code_rounded, size: 18),
                label: const Text('Export ArcSight CEF'),
              ),
            ],
          ),
          const SizedBox(height: 28),
          const Divider(),
          const SizedBox(height: 16),
          const Text('Log Retention Policy & Archival', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 6),
          const Text(
            'In accordance with compliance policy, logs past retention period (90 days) can be securely purged while preserving cryptographic audit proof.',
            style: TextStyle(fontSize: 13, color: Color(0xFF616161)),
          ),
          const SizedBox(height: 16),
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFE53935)),
            onPressed: () async {
              final result = await _auditService.enforceRetention(retentionDays: 90);
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(
                      result['recordsPurged'] != null
                          ? 'Retention policy enforced. Purged ${result['recordsPurged']} records.'
                          : 'Retention policy checked: ${result['message']}',
                    ),
                  ),
                );
              }
            },
            icon: const Icon(Icons.delete_sweep_rounded, color: Colors.white, size: 18),
            label: const Text('Enforce 90-Day Retention Policy', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFAFAFA),
      appBar: AppBar(
        title: const Text('Audit Trails & Security Monitoring', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
        backgroundColor: Colors.white,
        elevation: 0.5,
        foregroundColor: Colors.black87,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadAllData,
            tooltip: 'Refresh Dashboard',
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          labelColor: const Color(0xFF0095F6),
          unselectedLabelColor: const Color(0xFF757575),
          indicatorColor: const Color(0xFF0095F6),
          tabs: const [
            Tab(text: 'Audit Trail'),
            Tab(text: 'Security Alerts'),
            Tab(text: 'SIEM & Retention'),
          ],
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _errorMessage != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.error_outline, size: 48, color: Color(0xFFE53935)),
                        const SizedBox(height: 12),
                        Text(_errorMessage!, textAlign: TextAlign.center),
                        const SizedBox(height: 16),
                        ElevatedButton(onPressed: _loadAllData, child: const Text('Retry')),
                      ],
                    ),
                  ),
                )
              : Column(
                  children: [
                    // Metric Summary Cards
                    if (_dashboard != null)
                      Padding(
                        padding: const EdgeInsets.all(16),
                        child: Row(
                          children: [
                            _buildMetricCard(
                              'Total Logs',
                              _dashboard!.summary.totalLogs.toString(),
                              Icons.history_rounded,
                              const Color(0xFF0095F6),
                            ),
                            const SizedBox(width: 8),
                            _buildMetricCard(
                              '24h Logs',
                              _dashboard!.summary.todayLogs.toString(),
                              Icons.timeline_rounded,
                              const Color(0xFF43A047),
                            ),
                            const SizedBox(width: 8),
                            _buildMetricCard(
                              'Failed Logins',
                              _dashboard!.summary.failedLogins24h.toString(),
                              Icons.lock_clock_rounded,
                              const Color(0xFFFB8C00),
                            ),
                            const SizedBox(width: 8),
                            _buildMetricCard(
                              'Open Alerts',
                              _dashboard!.summary.openAlerts.toString(),
                              Icons.warning_amber_rounded,
                              const Color(0xFFE53935),
                            ),
                          ],
                        ),
                      ),

                    // Integrity Banner
                    _buildIntegrityBanner(),

                    // Tab views
                    Expanded(
                      child: TabBarView(
                        controller: _tabController,
                        children: [
                          _buildAuditLogsTab(),
                          _buildAlertsTab(),
                          _buildRetentionTab(),
                        ],
                      ),
                    ),
                  ],
                ),
    );
  }
}
