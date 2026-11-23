import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../services/api_client.dart';

class PrivacyAndSafetyScreen extends StatefulWidget {
  const PrivacyAndSafetyScreen({super.key});

  @override
  State<PrivacyAndSafetyScreen> createState() => _PrivacyAndSafetyScreenState();
}

class _PrivacyAndSafetyScreenState extends State<PrivacyAndSafetyScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  bool _isLoading = true;

  // Data
  List<Map<String, dynamic>> _policies = [];
  List<Map<String, dynamic>> _myRequests = [];
  List<Map<String, dynamic>> _blockedUsers = [];
  Map<String, bool> _consents = {
    'ANALYTICS': true,
    'PERSONALIZATION': true,
    'SECURITY_TELEMETRY': true,
    'MARKETING': false,
  };

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    _loadAllPrivacyData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadAllPrivacyData() async {
    setState(() => _isLoading = true);
    try {
      final results = await Future.wait([
        ApiClient.instance.getActivePolicies(),
        ApiClient.instance.getMyPrivacyRequests(),
        ApiClient.instance.getMyConsents(),
        ApiClient.instance.getBlockedUsers(),
      ]);

      if (mounted) {
        final policies = results[0] as List<Map<String, dynamic>>;
        final requests = results[1] as List<Map<String, dynamic>>;
        final consentsList = results[2] as List<Map<String, dynamic>>;
        final blocked = results[3] as List<Map<String, dynamic>>;

        final updatedConsents = Map<String, bool>.from(_consents);
        for (final c in consentsList) {
          final purpose = c['purpose']?.toString().toUpperCase();
          final granted = c['granted'] == true;
          if (purpose != null && updatedConsents.containsKey(purpose)) {
            updatedConsents[purpose] = granted;
          }
        }

        setState(() {
          _policies = policies;
          _myRequests = requests;
          _consents = updatedConsents;
          _blockedUsers = blocked;
          _isLoading = false;
        });
      }
    } catch (e) {
      debugPrint('Error loading privacy data: $e');
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _toggleConsent(String purpose, bool value) async {
    setState(() {
      _consents[purpose] = value;
    });

    try {
      await ApiClient.instance.recordConsent(purpose: purpose, granted: value);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Privacy preference for $purpose updated'),
            backgroundColor: const Color(0xFF1A1D24),
            duration: const Duration(seconds: 2),
          ),
        );
      }
    } catch (e) {
      debugPrint('Failed to save consent: $e');
      if (mounted) {
        setState(() {
          _consents[purpose] = !value; // revert
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Failed to update consent preference'),
            backgroundColor: Color(0xFFFE2C55),
          ),
        );
      }
    }
  }

  void _showPolicyReader(Map<String, dynamic> policy) {
    final title = policy['title'] ?? 'Policy';
    final category = policy['category'] ?? 'GENERAL';
    final activeVersion = policy['activeVersion'] as Map<String, dynamic>?;
    final versionNumber = activeVersion?['versionNumber'] ?? '1.0';
    final content = activeVersion?['content'] ?? policy['description'] ?? 'No text provided.';
    final effectiveDate = activeVersion?['effectiveDate']?.toString().split('T').first ?? 'Current';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF161920),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return DraggableScrollableSheet(
          initialChildSize: 0.85,
          minChildSize: 0.5,
          maxChildSize: 0.95,
          expand: false,
          builder: (context, scrollController) {
            return Column(
              children: [
                const SizedBox(height: 12),
                Container(
                  height: 4,
                  width: 40,
                  decoration: BoxDecoration(
                    color: Colors.white24,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              title,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Category: $category • Version $versionNumber • Effective: $effectiveDate',
                              style: const TextStyle(color: Colors.white54, fontSize: 12),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close, color: Colors.white70),
                        onPressed: () => Navigator.pop(ctx),
                      ),
                    ],
                  ),
                ),
                const Divider(color: Color(0xFF262A34), height: 1),
                Expanded(
                  child: SingleChildScrollView(
                    controller: scrollController,
                    padding: const EdgeInsets.all(20),
                    child: SelectableText(
                      content,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                        height: 1.6,
                      ),
                    ),
                  ),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Future<void> _exportMyData() async {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => const Center(
        child: CircularProgressIndicator(color: Color(0xFF3797EF)),
      ),
    );

    try {
      final exportData = await ApiClient.instance.exportMyData();
      if (mounted) Navigator.pop(context); // Dismiss loading

      if (!mounted) return;

      final jsonStr = const JsonEncoder.withIndent('  ').convert(exportData);
      final generatedAt = exportData['generatedAt']?.toString().split('T').first ?? 'Today';
      final complianceNotice = exportData['complianceNotice']?.toString() ?? 'Proclamation No. 1321/2024';

      showDialog(
        context: context,
        builder: (ctx) {
          return AlertDialog(
            backgroundColor: const Color(0xFF161920),
            title: Row(
              children: const [
                Icon(Icons.download_done, color: Color(0xFF10B981)),
                SizedBox(width: 8),
                Text('Personal Data Export', style: TextStyle(color: Colors.white, fontSize: 18)),
              ],
            ),
            content: SizedBox(
              width: double.maxFinite,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Your data archive was prepared in accordance with $complianceNotice ($generatedAt).',
                    style: const TextStyle(color: Colors.white70, fontSize: 13),
                  ),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0F1115),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFF262A34)),
                    ),
                    constraints: const BoxConstraints(maxHeight: 180),
                    child: SingleChildScrollView(
                      child: Text(
                        jsonStr,
                        style: const TextStyle(
                          color: Colors.white70,
                          fontFamily: 'monospace',
                          fontSize: 11,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            actions: [
              TextButton.icon(
                onPressed: () {
                  Clipboard.setData(ClipboardData(text: jsonStr));
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Copied data archive JSON to clipboard')),
                  );
                },
                icon: const Icon(Icons.copy, size: 16, color: Color(0xFF3797EF)),
                label: const Text('Copy JSON', style: TextStyle(color: Color(0xFF3797EF))),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF3797EF)),
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Done', style: TextStyle(color: Colors.white)),
              ),
            ],
          );
        },
      );
    } catch (e) {
      if (mounted) Navigator.pop(context);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to generate export: $e'),
            backgroundColor: const Color(0xFFFE2C55),
          ),
        );
      }
    }
  }

  void _showSubmitRequestDialog(String requestType) {
    final title = requestType == 'CORRECTION'
        ? 'Request Data Correction'
        : requestType == 'DELETION'
            ? 'Request Account Deletion'
            : 'Submit Privacy Request';

    final textController = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          backgroundColor: const Color(0xFF161920),
          title: Text(title, style: const TextStyle(color: Colors.white, fontSize: 18)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (requestType == 'DELETION')
                Container(
                  padding: const EdgeInsets.all(10),
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFE2C55).withOpacity(0.12),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFFE2C55).withOpacity(0.3)),
                  ),
                  child: const Text(
                    'Important: Account deletion triggers a 30-day grace retention period under security policy before permanent anonymization. All your active sessions will be marked for termination.',
                    style: TextStyle(color: Color(0xFFFF8080), fontSize: 12),
                  ),
                ),
              Text(
                requestType == 'CORRECTION'
                    ? 'Please describe which records are inaccurate and specify the correct details:'
                    : 'Please provide reason or additional context for your request:',
                style: const TextStyle(color: Colors.white70, fontSize: 13),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: textController,
                maxLines: 4,
                style: const TextStyle(color: Colors.white, fontSize: 14),
                decoration: InputDecoration(
                  hintText: 'Enter details here...',
                  hintStyle: const TextStyle(color: Colors.white38),
                  filled: true,
                  fillColor: const Color(0xFF0F1115),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: const BorderSide(color: Color(0xFF262A34)),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: const BorderSide(color: Color(0xFF3797EF)),
                  ),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel', style: TextStyle(color: Colors.white54)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: requestType == 'DELETION' ? const Color(0xFFFE2C55) : const Color(0xFF3797EF),
              ),
              onPressed: () async {
                final details = textController.text.trim();
                if (details.isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Please provide request details')),
                  );
                  return;
                }
                Navigator.pop(ctx);
                try {
                  await ApiClient.instance.submitPrivacyRequest(
                    requestType: requestType,
                    details: details,
                  );
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text('$title submitted successfully. Compliance team will review.'),
                        backgroundColor: const Color(0xFF10B981),
                      ),
                    );
                    _loadAllPrivacyData();
                  }
                } catch (e) {
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Error: $e'), backgroundColor: const Color(0xFFFE2C55)),
                    );
                  }
                }
              },
              child: const Text('Submit', style: TextStyle(color: Colors.white)),
            ),
          ],
        );
      },
    );
  }

  Future<void> _unblockUser(String targetUserId, String username) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF161920),
        title: const Text('Unblock Account', style: TextStyle(color: Colors.white)),
        content: Text(
          'Are you sure you want to unblock @$username? They will be able to view your public posts and interact with your account.',
          style: const TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel', style: TextStyle(color: Colors.white54)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF3797EF)),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Unblock', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      try {
        await ApiClient.instance.unblockUser(targetUserId);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Unblocked @$username')),
          );
          _loadAllPrivacyData();
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Failed to unblock: $e'), backgroundColor: const Color(0xFFFE2C55)),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F1115),
      appBar: AppBar(
        backgroundColor: const Color(0xFF161920),
        elevation: 0,
        title: const Text(
          'Privacy & Safety',
          style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
        ),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: const Color(0xFF3797EF),
          indicatorWeight: 3,
          labelColor: const Color(0xFF3797EF),
          unselectedLabelColor: Colors.white54,
          labelStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
          isScrollable: true,
          tabs: const [
            Tab(text: 'Data Rights'),
            Tab(text: 'Preferences'),
            Tab(text: 'Policies'),
            Tab(text: 'Blocked Users'),
          ],
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF3797EF)))
          : TabBarView(
              controller: _tabController,
              children: [
                _buildDataRightsTab(),
                _buildPreferencesTab(),
                _buildPoliciesTab(),
                _buildBlockedUsersTab(),
              ],
            ),
    );
  }

  // ===================== TAB 1: DATA RIGHTS =====================
  Widget _buildDataRightsTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Governance notice
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF1E293B), Color(0xFF0F172A)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFF334155)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: const [
                  Icon(Icons.shield_outlined, color: Color(0xFF38BDF8), size: 22),
                  SizedBox(width: 8),
                  Text(
                    'Ethiopian Proclamation No. 1321/2024',
                    style: TextStyle(color: Color(0xFF38BDF8), fontWeight: FontWeight.bold, fontSize: 14),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              const Text(
                'News Share safeguards your privacy and guarantees your legal rights to data access, rectification, portability, and deletion. Your personal data is never sold.',
                style: TextStyle(color: Colors.white70, fontSize: 13, height: 1.4),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),

        const Text(
          'Your Data Subject Rights',
          style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 12),

        // Action 1: Export Data
        _buildActionCard(
          icon: Icons.download_for_offline_outlined,
          iconColor: const Color(0xFF38BDF8),
          title: 'Download Data Archive',
          subtitle: 'Export a complete, machine-readable JSON copy of your profile, posts, comments, votes, and consents.',
          buttonText: 'Export Data',
          onTap: _exportMyData,
        ),
        const SizedBox(height: 12),

        // Action 2: Correction
        _buildActionCard(
          icon: Icons.edit_note,
          iconColor: const Color(0xFFF59E0B),
          title: 'Request Data Rectification',
          subtitle: 'Notify our compliance officers to correct inaccurate, incomplete, or outdated personal information.',
          buttonText: 'Request Correction',
          onTap: () => _showSubmitRequestDialog('CORRECTION'),
        ),
        const SizedBox(height: 12),

        // Action 3: Deletion
        _buildActionCard(
          icon: Icons.delete_forever_outlined,
          iconColor: const Color(0xFFFE2C55),
          title: 'Request Account Deletion',
          subtitle: 'Permanently erase your account, publications, and identifiable data (subject to 30-day security grace period).',
          buttonText: 'Request Deletion',
          buttonColor: const Color(0xFFFE2C55),
          onTap: () => _showSubmitRequestDialog('DELETION'),
        ),
        const SizedBox(height: 24),

        // Section: Past Requests
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'My Privacy Requests',
              style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
            ),
            IconButton(
              icon: const Icon(Icons.refresh, color: Colors.white54, size: 20),
              onPressed: _loadAllPrivacyData,
            ),
          ],
        ),
        const SizedBox(height: 8),

        if (_myRequests.isEmpty)
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: const Color(0xFF161920),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Center(
              child: Text(
                'No privacy requests submitted yet.',
                style: TextStyle(color: Colors.white38, fontSize: 13),
              ),
            ),
          )
        else
          ..._myRequests.map((req) {
            final type = req['requestType'] ?? 'REQUEST';
            final status = req['status'] ?? 'PENDING';
            final date = req['createdAt']?.toString().split('T').first ?? '';
            final notes = req['adminNotes']?.toString();

            Color statusColor;
            switch (status) {
              case 'COMPLETED':
                statusColor = const Color(0xFF10B981);
                break;
              case 'IN_REVIEW':
                statusColor = const Color(0xFF38BDF8);
                break;
              case 'REJECTED':
                statusColor = const Color(0xFFFE2C55);
                break;
              default:
                statusColor = const Color(0xFFF59E0B);
            }

            return Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFF161920),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFF262A34)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        type,
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: statusColor.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: statusColor.withOpacity(0.4)),
                        ),
                        child: Text(
                          status,
                          style: TextStyle(color: statusColor, fontSize: 11, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    req['details'] ?? '',
                    style: const TextStyle(color: Colors.white70, fontSize: 13),
                  ),
                  if (notes != null && notes.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(
                      'Admin Response: $notes',
                      style: const TextStyle(color: Color(0xFF38BDF8), fontSize: 12),
                    ),
                  ],
                  const SizedBox(height: 6),
                  Text(
                    'Submitted: $date',
                    style: const TextStyle(color: Colors.white38, fontSize: 11),
                  ),
                ],
              ),
            );
          }),
      ],
    );
  }

  Widget _buildActionCard({
    required IconData icon,
    required Color iconColor,
    required String title,
    required String subtitle,
    required String buttonText,
    required VoidCallback onTap,
    Color? buttonColor,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF161920),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF262A34)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: iconColor.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, color: iconColor, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            subtitle,
            style: const TextStyle(color: Colors.white70, fontSize: 13, height: 1.4),
          ),
          const SizedBox(height: 12),
          Align(
            alignment: Alignment.centerRight,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: buttonColor ?? const Color(0xFF3797EF),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              ),
              onPressed: onTap,
              child: Text(
                buttonText,
                style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ===================== TAB 2: PREFERENCES =====================
  Widget _buildPreferencesTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text(
          'Consent & Data Processing Preferences',
          style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 6),
        const Text(
          'Manage how News Share uses your data for product improvement, analytics, and personalization.',
          style: TextStyle(color: Colors.white54, fontSize: 13),
        ),
        const SizedBox(height: 16),

        _buildConsentSwitch(
          title: 'Platform Analytics & Performance',
          subtitle: 'Collect anonymous app metrics, crash logs, and feature interaction data to enhance stability.',
          purpose: 'ANALYTICS',
          value: _consents['ANALYTICS'] ?? true,
        ),
        _buildConsentSwitch(
          title: 'Feed Personalization & Recommendations',
          subtitle: 'Use your reading history and followed topics to curate customized news stories in your feed.',
          purpose: 'PERSONALIZATION',
          value: _consents['PERSONALIZATION'] ?? true,
        ),
        _buildConsentSwitch(
          title: 'Security Auditing & Fraud Telemetry',
          subtitle: 'Analyze session patterns to detect unauthorized access, automated scrapers, and account takeovers.',
          purpose: 'SECURITY_TELEMETRY',
          value: _consents['SECURITY_TELEMETRY'] ?? true,
        ),
        _buildConsentSwitch(
          title: 'Product News & Informational Updates',
          subtitle: 'Receive occasional emails and announcements regarding feature launches and platform improvements.',
          purpose: 'MARKETING',
          value: _consents['MARKETING'] ?? false,
        ),
      ],
    );
  }

  Widget _buildConsentSwitch({
    required String title,
    required String subtitle,
    required String purpose,
    required bool value,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF161920),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFF262A34)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  style: const TextStyle(color: Colors.white54, fontSize: 12, height: 1.3),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Switch(
            value: value,
            activeColor: const Color(0xFF3797EF),
            onChanged: (newVal) => _toggleConsent(purpose, newVal),
          ),
        ],
      ),
    );
  }

  // ===================== TAB 3: POLICIES =====================
  Widget _buildPoliciesTab() {
    if (_policies.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.policy_outlined, size: 48, color: Colors.white24),
            const SizedBox(height: 12),
            const Text('No published policies found.', style: TextStyle(color: Colors.white54)),
            const SizedBox(height: 12),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF3797EF)),
              onPressed: _loadAllPrivacyData,
              child: const Text('Refresh', style: TextStyle(color: Colors.white)),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _policies.length,
      itemBuilder: (context, idx) {
        final policy = _policies[idx];
        final title = policy['title'] ?? 'Policy';
        final category = policy['category'] ?? 'GENERAL';
        final activeVersion = policy['activeVersion'] as Map<String, dynamic>?;
        final versionNumber = activeVersion?['versionNumber'] ?? '1.0';
        final description = policy['description'] ?? 'Tap to read full terms and provisions.';

        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          decoration: BoxDecoration(
            color: const Color(0xFF161920),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: const Color(0xFF262A34)),
          ),
          child: ListTile(
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            leading: Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFF3797EF).withOpacity(0.12),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.description_outlined, color: Color(0xFF3797EF), size: 22),
            ),
            title: Text(
              title,
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
            ),
            subtitle: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 4),
                Text(
                  description,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: Colors.white54, fontSize: 12),
                ),
                const SizedBox(height: 4),
                Text(
                  'Category: $category • v$versionNumber',
                  style: const TextStyle(color: Color(0xFF38BDF8), fontSize: 11, fontWeight: FontWeight.w600),
                ),
              ],
            ),
            trailing: const Icon(Icons.arrow_forward_ios, color: Colors.white38, size: 14),
            onTap: () => _showPolicyReader(policy),
          ),
        );
      },
    );
  }

  // ===================== TAB 4: BLOCKED USERS =====================
  Widget _buildBlockedUsersTab() {
    if (_blockedUsers.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: const [
            Icon(Icons.block, size: 48, color: Colors.white24),
            SizedBox(height: 12),
            Text(
              'You have not blocked any accounts.',
              style: TextStyle(color: Colors.white54, fontSize: 14),
            ),
            SizedBox(height: 4),
            Text(
              'Blocked accounts cannot message you or see your profile.',
              style: TextStyle(color: Colors.white38, fontSize: 12),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _blockedUsers.length,
      itemBuilder: (context, idx) {
        final b = _blockedUsers[idx];
        final blockedUser = b['blocked'] as Map<String, dynamic>?;
        final username = blockedUser?['username'] ?? 'User';
        final fullName = blockedUser?['fullName'] ?? '';
        final blockedUserId = b['blockedId'] ?? blockedUser?['id'] ?? '';
        final blockDate = b['createdAt']?.toString().split('T').first ?? '';

        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: const Color(0xFF161920),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: const Color(0xFF262A34)),
          ),
          child: Row(
            children: [
              CircleAvatar(
                radius: 20,
                backgroundColor: const Color(0xFF262A34),
                child: Text(
                  username.isNotEmpty ? username[0].toUpperCase() : 'U',
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      username,
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                    ),
                    if (fullName.isNotEmpty)
                      Text(fullName, style: const TextStyle(color: Colors.white54, fontSize: 12)),
                    Text(
                      'Blocked on $blockDate',
                      style: const TextStyle(color: Colors.white38, fontSize: 11),
                    ),
                  ],
                ),
              ),
              OutlinedButton(
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: Color(0xFF3797EF)),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                ),
                onPressed: () => _unblockUser(blockedUserId, username),
                child: const Text('Unblock', style: TextStyle(color: Color(0xFF3797EF), fontSize: 12)),
              ),
            ],
          ),
        );
      },
    );
  }
}
