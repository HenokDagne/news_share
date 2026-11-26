import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../services/api_client.dart';

class PrivacyAndSafetyScreen extends StatefulWidget {
  const PrivacyAndSafetyScreen({super.key});

  @override
  State<PrivacyAndSafetyScreen> createState() => _PrivacyAndSafetyScreenState();
}

class _PrivacyAndSafetyScreenState extends State<PrivacyAndSafetyScreen> {
  bool _isLoading = true;

  // Discoverability & Privacy Settings
  bool _privateAccount = false;
  bool _activityStatus = true;
  bool _suggestAccount = true;
  bool _syncContacts = false;
  bool _locationServices = false;

  // Interaction Settings
  String _commentPermission = 'EVERYONE';
  String _mentionPermission = 'EVERYONE';
  String _dmPermission = 'FRIENDS';

  // Compliance & Telemetry
  bool _analyticsPerformance = true;
  bool _feedPersonalization = true;
  bool _securityTelemetry = true;
  bool _productNewsUpdates = false;

  // Data
  List<Map<String, dynamic>> _policies = [];
  List<Map<String, dynamic>> _myRequests = [];
  List<Map<String, dynamic>> _blockedUsers = [];
  Map<String, dynamic>? _activeDeletionRequest;

  @override
  void initState() {
    super.initState();
    _loadAllPrivacyData();
  }

  Future<void> _loadAllPrivacyData() async {
    setState(() => _isLoading = true);
    try {
      final results = await Future.wait([
        ApiClient.instance.getActivePolicies(),
        ApiClient.instance.getMyPrivacyRequests(),
        ApiClient.instance.getPrivacyPreferences(),
        ApiClient.instance.getBlockedUsers(),
      ]);

      if (mounted) {
        final policies = results[0] as List<Map<String, dynamic>>;
        final requests = results[1] as List<Map<String, dynamic>>;
        final prefs = results[2] as Map<String, dynamic>;
        final blocked = results[3] as List<Map<String, dynamic>>;

        Map<String, dynamic>? activeDel;
        for (final r in requests) {
          if (r['requestType'] == 'ACCOUNT_DELETION' &&
              (r['status'] == 'PENDING' || r['status'] == 'UNDER_REVIEW')) {
            activeDel = r;
            break;
          }
        }

        setState(() {
          _policies = policies;
          _myRequests = requests;
          _blockedUsers = blocked;
          _activeDeletionRequest = activeDel;

          if (prefs.containsKey('privateAccount')) {
            _privateAccount = prefs['privateAccount'] == true;
          }
          if (prefs.containsKey('activityStatus')) {
            _activityStatus = prefs['activityStatus'] != false;
          }
          if (prefs.containsKey('suggestAccount')) {
            _suggestAccount = prefs['suggestAccount'] != false;
          }
          if (prefs.containsKey('syncContacts')) {
            _syncContacts = prefs['syncContacts'] == true;
          }
          if (prefs.containsKey('locationServices')) {
            _locationServices = prefs['locationServices'] == true;
          }
          if (prefs.containsKey('commentPermission') && prefs['commentPermission'] != null) {
            _commentPermission = prefs['commentPermission'].toString();
          }
          if (prefs.containsKey('mentionPermission') && prefs['mentionPermission'] != null) {
            _mentionPermission = prefs['mentionPermission'].toString();
          }
          if (prefs.containsKey('dmPermission') && prefs['dmPermission'] != null) {
            _dmPermission = prefs['dmPermission'].toString();
          }
          if (prefs.containsKey('analyticsPerformance')) {
            _analyticsPerformance = prefs['analyticsPerformance'] != false;
          }
          if (prefs.containsKey('feedPersonalization')) {
            _feedPersonalization = prefs['feedPersonalization'] != false;
          }
          if (prefs.containsKey('securityTelemetry')) {
            _securityTelemetry = prefs['securityTelemetry'] != false;
          }
          if (prefs.containsKey('productNewsUpdates')) {
            _productNewsUpdates = prefs['productNewsUpdates'] == true;
          }

          _isLoading = false;
        });
      }
    } catch (e) {
      debugPrint('Failed to load privacy data: $e');
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _updatePreference({
    bool? privateAccount,
    bool? activityStatus,
    bool? suggestAccount,
    bool? syncContacts,
    bool? locationServices,
    String? commentPermission,
    String? mentionPermission,
    String? dmPermission,
    bool? analyticsPerformance,
    bool? feedPersonalization,
    bool? securityTelemetry,
    bool? productNewsUpdates,
  }) async {
    setState(() {
      if (privateAccount != null) _privateAccount = privateAccount;
      if (activityStatus != null) _activityStatus = activityStatus;
      if (suggestAccount != null) _suggestAccount = suggestAccount;
      if (syncContacts != null) _syncContacts = syncContacts;
      if (locationServices != null) _locationServices = locationServices;
      if (commentPermission != null) _commentPermission = commentPermission;
      if (mentionPermission != null) _mentionPermission = mentionPermission;
      if (dmPermission != null) _dmPermission = dmPermission;
      if (analyticsPerformance != null) _analyticsPerformance = analyticsPerformance;
      if (feedPersonalization != null) _feedPersonalization = feedPersonalization;
      if (securityTelemetry != null) _securityTelemetry = securityTelemetry;
      if (productNewsUpdates != null) _productNewsUpdates = productNewsUpdates;
    });

    try {
      await ApiClient.instance.updatePrivacyPreferences(
        privateAccount: privateAccount,
        activityStatus: activityStatus,
        suggestAccount: suggestAccount,
        syncContacts: syncContacts,
        locationServices: locationServices,
        commentPermission: commentPermission,
        mentionPermission: mentionPermission,
        dmPermission: dmPermission,
        analyticsPerformance: analyticsPerformance,
        feedPersonalization: feedPersonalization,
        securityTelemetry: securityTelemetry,
        productNewsUpdates: productNewsUpdates,
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to update setting: $e'),
            backgroundColor: const Color(0xFFFE2C55),
          ),
        );
      }
    }
  }

  void _handleBackNavigation() {
    if (Navigator.of(context).canPop()) {
      Navigator.of(context).pop();
    } else {
      Navigator.of(context).pushReplacementNamed('/profile');
    }
  }

  @override
  Widget build(BuildContext context) {
    const bgColor = Color(0xFFF8F8FA);
    const cardColor = Colors.white;
    const primaryTextColor = Color(0xFF161823);
    const secondaryTextColor = Color(0xFF737373);
    const dividerColor = Color(0xFFEBECEF);
    const activeColor = Color(0xFF20D5EC);

    return Scaffold(
      backgroundColor: bgColor,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0.5,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: primaryTextColor, size: 22),
          onPressed: _handleBackNavigation,
        ),
        title: const Text(
          'Privacy',
          style: TextStyle(
            color: primaryTextColor,
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
        centerTitle: true,
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(color: activeColor),
            )
          : RefreshIndicator(
              color: activeColor,
              onRefresh: _loadAllPrivacyData,
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                children: [
                  // ACTIVE DELETION NOTICE BANNER IF PENDING
                  if (_activeDeletionRequest != null) ...[
                    _buildPendingDeletionBanner(),
                    const SizedBox(height: 16),
                  ],

                  // 1. DISCOVERABILITY
                  _buildSectionHeader('Discoverability', secondaryTextColor),
                  _buildSettingsCard(
                    cardColor: cardColor,
                    dividerColor: dividerColor,
                    children: [
                      _buildSwitchTile(
                        title: 'Private account',
                        description:
                            'With a private account, only people you approve can view your profile and posts. Existing followers won\'t be affected.',
                        value: _privateAccount,
                        activeColor: activeColor,
                        primaryColor: primaryTextColor,
                        secondaryColor: secondaryTextColor,
                        onChanged: (val) {
                          _updatePreference(privateAccount: val);
                        },
                      ),
                      _buildSwitchTile(
                        title: 'Activity status',
                        description:
                            'When this is turned on, you and your friends (followers you follow back) will see each other\'s activity status. You will only see each other\'s activity status when both of you turn this on.',
                        value: _activityStatus,
                        activeColor: activeColor,
                        primaryColor: primaryTextColor,
                        secondaryColor: secondaryTextColor,
                        onChanged: (val) {
                          _updatePreference(activityStatus: val);
                        },
                      ),
                      _buildNavTile(
                        title: 'Suggest your account to others',
                        primaryColor: primaryTextColor,
                        secondaryColor: secondaryTextColor,
                        onTap: () => _showSuggestAccountSheet(),
                      ),
                      _buildNavTile(
                        title: 'Sync contacts and Facebook friends',
                        primaryColor: primaryTextColor,
                        secondaryColor: secondaryTextColor,
                        onTap: () => _showSyncContactsSheet(),
                      ),
                      _buildNavTile(
                        title: 'Location services',
                        description:
                            'Manage the location information News Share uses to personalise your experience.',
                        primaryColor: primaryTextColor,
                        secondaryColor: secondaryTextColor,
                        isLast: true,
                        onTap: () => _showLocationServicesSheet(),
                      ),
                    ],
                  ),

                  const SizedBox(height: 24),

                  // 2. INTERACTIONS
                  _buildSectionHeader('Interactions', secondaryTextColor),
                  _buildSettingsCard(
                    cardColor: cardColor,
                    dividerColor: dividerColor,
                    children: [
                      _buildNavTile(
                        icon: Icons.chat_bubble_outline,
                        title: 'Comments',
                        trailingText: _formatPermissionLabel(_commentPermission),
                        primaryColor: primaryTextColor,
                        secondaryColor: secondaryTextColor,
                        onTap: () => _showPermissionPicker(
                          title: 'Who can comment on your posts',
                          currentValue: _commentPermission,
                          options: const ['EVERYONE', 'FOLLOWERS', 'NO_ONE'],
                          onSelected: (val) => _updatePreference(commentPermission: val),
                        ),
                      ),
                      _buildNavTile(
                        icon: Icons.alternate_email,
                        title: 'Mentions',
                        trailingText: _formatPermissionLabel(_mentionPermission),
                        primaryColor: primaryTextColor,
                        secondaryColor: secondaryTextColor,
                        onTap: () => _showPermissionPicker(
                          title: 'Who can mention you',
                          currentValue: _mentionPermission,
                          options: const ['EVERYONE', 'FOLLOWERS', 'NO_ONE'],
                          onSelected: (val) => _updatePreference(mentionPermission: val),
                        ),
                      ),
                      _buildNavTile(
                        icon: Icons.send_outlined,
                        title: 'Direct messages',
                        trailingText: _formatPermissionLabel(_dmPermission),
                        primaryColor: primaryTextColor,
                        secondaryColor: secondaryTextColor,
                        onTap: () => _showPermissionPicker(
                          title: 'Who can send you direct messages',
                          currentValue: _dmPermission,
                          options: const ['EVERYONE', 'FRIENDS', 'NO_ONE'],
                          onSelected: (val) => _updatePreference(dmPermission: val),
                        ),
                      ),
                      _buildNavTile(
                        icon: Icons.block_outlined,
                        title: 'Blocked accounts',
                        trailingText: _blockedUsers.isNotEmpty ? '${_blockedUsers.length}' : '',
                        primaryColor: primaryTextColor,
                        secondaryColor: secondaryTextColor,
                        isLast: true,
                        onTap: () => _showBlockedAccountsPage(),
                      ),
                    ],
                  ),

                  const SizedBox(height: 24),

                  // 3. SECURITY CHECKUP
                  _buildSectionHeader('Account Security', secondaryTextColor),
                  _buildSettingsCard(
                    cardColor: cardColor,
                    dividerColor: dividerColor,
                    children: [
                      _buildNavTile(
                        icon: Icons.verified_user_outlined,
                        iconColor: const Color(0xFF00B074),
                        title: 'Security checkup',
                        badge: 'Protected',
                        badgeColor: const Color(0xFF00B074),
                        primaryColor: primaryTextColor,
                        secondaryColor: secondaryTextColor,
                        onTap: () => _showSecurityCheckupSheet(),
                      ),
                      _buildSwitchTile(
                        icon: Icons.shield_outlined,
                        title: 'Essential security telemetry',
                        description:
                            'Audit logs for account protection, login verification, and fraud prevention under Proclamation No. 1321/2024.',
                        value: _securityTelemetry,
                        activeColor: activeColor,
                        primaryColor: primaryTextColor,
                        secondaryColor: secondaryTextColor,
                        isLast: true,
                        onChanged: (val) {
                          if (!val) {
                            _showEssentialTelemetryWarning();
                          } else {
                            _updatePreference(securityTelemetry: true);
                          }
                        },
                      ),
                    ],
                  ),

                  const SizedBox(height: 24),

                  // 4. DATA & SAFETY
                  _buildSectionHeader('Data Rights & Policies', secondaryTextColor),
                  _buildSettingsCard(
                    cardColor: cardColor,
                    dividerColor: dividerColor,
                    children: [
                      _buildNavTile(
                        icon: Icons.download_for_offline_outlined,
                        title: 'Download your data',
                        description:
                            'Request a machine-readable archive of your personal data per Ethiopian Proclamation No. 1321/2024.',
                        primaryColor: primaryTextColor,
                        secondaryColor: secondaryTextColor,
                        onTap: () => _showDataExportDialog(),
                      ),
                      _buildNavTile(
                        icon: Icons.tune,
                        title: 'Personalization & preferences',
                        description: 'Manage feed personalization algorithms and analytics.',
                        primaryColor: primaryTextColor,
                        secondaryColor: secondaryTextColor,
                        onTap: () => _showPersonalizationSheet(),
                      ),
                      _buildNavTile(
                        icon: Icons.description_outlined,
                        title: 'Terms and policies',
                        description: 'Official agreements, privacy policy, and community guidelines.',
                        primaryColor: primaryTextColor,
                        secondaryColor: secondaryTextColor,
                        onTap: () => _showPoliciesListSheet(),
                      ),
                      _buildNavTile(
                        icon: Icons.delete_outline,
                        iconColor: const Color(0xFFFE2C55),
                        title: 'Delete account',
                        description:
                            'Schedule permanent account removal with a 30-day security grace period.',
                        primaryColor: const Color(0xFFFE2C55),
                        secondaryColor: secondaryTextColor,
                        isLast: true,
                        onTap: () => _handleAccountDeletionAction(),
                      ),
                    ],
                  ),

                  const SizedBox(height: 36),
                  Center(
                    child: Text(
                      'News Share • Certified per Ethiopian Proclamation No. 1321/2024',
                      style: TextStyle(color: secondaryTextColor.withOpacity(0.7), fontSize: 11),
                    ),
                  ),
                  const SizedBox(height: 20),
                ],
              ),
            ),
    );
  }

  // ===================== HELPER UI BUILDERS =====================

  Widget _buildSectionHeader(String title, Color color) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 8),
      child: Text(
        title,
        style: TextStyle(
          color: color,
          fontSize: 13,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.2,
        ),
      ),
    );
  }

  Widget _buildSettingsCard({
    required Color cardColor,
    required Color dividerColor,
    required List<Widget> children,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: dividerColor, width: 0.8),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(children: children),
    );
  }

  Widget _buildSwitchTile({
    IconData? icon,
    required String title,
    String? description,
    required bool value,
    required Color activeColor,
    required Color primaryColor,
    required Color secondaryColor,
    required ValueChanged<bool> onChanged,
    bool isLast = false,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        border: isLast
            ? null
            : Border(
                bottom: BorderSide(
                  color: const Color(0xFFEBECEF).withOpacity(0.8),
                  width: 0.8,
                ),
              ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (icon != null) ...[
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Icon(icon, size: 20, color: primaryColor),
            ),
            const SizedBox(width: 12),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    color: primaryColor,
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                if (description != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    description,
                    style: TextStyle(
                      color: secondaryColor,
                      fontSize: 13,
                      height: 1.35,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 12),
          Switch(
            value: value,
            activeColor: activeColor,
            activeTrackColor: activeColor.withOpacity(0.4),
            inactiveThumbColor: Colors.white,
            inactiveTrackColor: const Color(0xFFD8D9DF),
            materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
            onChanged: onChanged,
          ),
        ],
      ),
    );
  }

  Widget _buildNavTile({
    IconData? icon,
    Color? iconColor,
    required String title,
    String? description,
    String? trailingText,
    String? badge,
    Color? badgeColor,
    required Color primaryColor,
    required Color secondaryColor,
    required VoidCallback onTap,
    bool isLast = false,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            border: isLast
                ? null
                : Border(
                    bottom: BorderSide(
                      color: const Color(0xFFEBECEF).withOpacity(0.8),
                      width: 0.8,
                    ),
                  ),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              if (icon != null) ...[
                Icon(icon, size: 20, color: iconColor ?? primaryColor),
                const SizedBox(width: 14),
              ],
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          title,
                          style: TextStyle(
                            color: primaryColor,
                            fontSize: 15,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        if (badge != null) ...[
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: (badgeColor ?? const Color(0xFF00B074)).withOpacity(0.12),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              badge,
                              style: TextStyle(
                                color: badgeColor ?? const Color(0xFF00B074),
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                    if (description != null) ...[
                      const SizedBox(height: 3),
                      Text(
                        description,
                        style: TextStyle(
                          color: secondaryColor,
                          fontSize: 12,
                          height: 1.3,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              if (trailingText != null && trailingText.isNotEmpty) ...[
                const SizedBox(width: 8),
                Text(
                  trailingText,
                  style: TextStyle(color: secondaryColor, fontSize: 14),
                ),
              ],
              const SizedBox(width: 6),
              const Icon(
                Icons.chevron_right,
                size: 20,
                color: Color(0xFFB0B3BA),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPendingDeletionBanner() {
    final scheduledDate = _activeDeletionRequest?['scheduledDeletionAt']?.toString().split('T').first ??
        _activeDeletionRequest?['createdAt']?.toString().split('T').first ??
        '30 days';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF2F4),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFFE2C55).withOpacity(0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: const [
              Icon(Icons.warning_amber_rounded, color: Color(0xFFFE2C55), size: 22),
              SizedBox(width: 8),
              Text(
                'Account Deletion Scheduled',
                style: TextStyle(color: Color(0xFFFE2C55), fontWeight: FontWeight.bold, fontSize: 15),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'Your account is in a 30-day security grace period. Permanent wipe is scheduled for $scheduledDate. You can cancel deletion at any time.',
            style: const TextStyle(color: Color(0xFF555555), fontSize: 13, height: 1.35),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFFE2C55),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              onPressed: _cancelDeletion,
              child: const Text('Cancel Account Deletion', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ),
        ],
      ),
    );
  }

  String _formatPermissionLabel(String val) {
    switch (val.toUpperCase()) {
      case 'EVERYONE':
        return 'Everyone';
      case 'FOLLOWERS':
        return 'Followers';
      case 'FRIENDS':
        return 'Friends';
      case 'NO_ONE':
        return 'No one';
      default:
        return val;
    }
  }

  // ===================== MODAL SHEETS & INTERACTION PICKERS =====================

  void _showPermissionPicker({
    required String title,
    required String currentValue,
    required List<String> options,
    required ValueChanged<String> onSelected,
  }) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 12),
                child: Text(
                  title,
                  style: const TextStyle(
                    color: Color(0xFF161823),
                    fontSize: 17,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              const Divider(color: Color(0xFFEBECEF), height: 1),
              ...options.map((opt) {
                final isSelected = opt.toUpperCase() == currentValue.toUpperCase();
                return ListTile(
                  title: Text(
                    _formatPermissionLabel(opt),
                    style: TextStyle(
                      color: const Color(0xFF161823),
                      fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                    ),
                  ),
                  trailing: isSelected
                      ? const Icon(Icons.check, color: Color(0xFF20D5EC), size: 20)
                      : null,
                  onTap: () {
                    Navigator.pop(ctx);
                    onSelected(opt);
                  },
                );
              }),
              const SizedBox(height: 12),
            ],
          ),
        );
      },
    );
  }

  void _showSuggestAccountSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            return SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Suggest your account to others',
                      style: TextStyle(color: Color(0xFF161823), fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Choose whether your account can be suggested to people searching for news creators or topics you cover.',
                      style: TextStyle(color: Color(0xFF737373), fontSize: 13, height: 1.35),
                    ),
                    const SizedBox(height: 16),
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Recommend profile', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                      subtitle: const Text('Allow suggestions to readers with shared news interests', style: TextStyle(color: Color(0xFF737373), fontSize: 12)),
                      value: _suggestAccount,
                      activeColor: const Color(0xFF20D5EC),
                      onChanged: (val) {
                        setSheetState(() => _suggestAccount = val);
                        _updatePreference(suggestAccount: val);
                      },
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  void _showSyncContactsSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            return SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Sync Contacts and Friends',
                      style: TextStyle(color: Color(0xFF161823), fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Find people you know on News Share by periodically matching device contact identifiers.',
                      style: TextStyle(color: Color(0xFF737373), fontSize: 13, height: 1.35),
                    ),
                    const SizedBox(height: 16),
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Sync device contacts', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                      subtitle: const Text('Contact data is salted and hashed to preserve privacy', style: TextStyle(color: Color(0xFF737373), fontSize: 12)),
                      value: _syncContacts,
                      activeColor: const Color(0xFF20D5EC),
                      onChanged: (val) {
                        setSheetState(() => _syncContacts = val);
                        _updatePreference(syncContacts: val);
                      },
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  void _showLocationServicesSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            return SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Location Services',
                      style: TextStyle(color: Color(0xFF161823), fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Manage whether News Share uses coarse regional location data to deliver breaking local news and community alerts.',
                      style: TextStyle(color: Color(0xFF737373), fontSize: 13, height: 1.35),
                    ),
                    const SizedBox(height: 16),
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Localized news feed', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                      subtitle: const Text('Tailors trending topics to your metropolitan area', style: TextStyle(color: Color(0xFF737373), fontSize: 12)),
                      value: _locationServices,
                      activeColor: const Color(0xFF20D5EC),
                      onChanged: (val) {
                        setSheetState(() => _locationServices = val);
                        _updatePreference(locationServices: val);
                      },
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  void _showSecurityCheckupSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return DraggableScrollableSheet(
          initialChildSize: 0.75,
          minChildSize: 0.5,
          maxChildSize: 0.9,
          expand: false,
          builder: (context, scrollController) {
            return SafeArea(
              child: FutureBuilder<Map<String, dynamic>>(
                future: ApiClient.instance.getSecurityCheckup(),
                builder: (context, snapshot) {
                  if (snapshot.connectionState == ConnectionState.waiting) {
                    return const Center(child: CircularProgressIndicator(color: Color(0xFF20D5EC)));
                  }

                  final data = snapshot.data ?? {};
                  final checks = (data['checks'] as List<dynamic>?) ?? [];
                  final isOverallGood = data['status'] == 'SECURE';

                  return ListView(
                    controller: scrollController,
                    padding: const EdgeInsets.all(20),
                    children: [
                      Center(
                        child: Container(
                          height: 4,
                          width: 40,
                          decoration: BoxDecoration(
                            color: const Color(0xFFD8D9DF),
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: (isOverallGood ? const Color(0xFF00B074) : const Color(0xFFFE2C55)).withOpacity(0.12),
                              shape: BoxShape.circle,
                            ),
                            child: Icon(
                              isOverallGood ? Icons.shield : Icons.warning_amber_rounded,
                              color: isOverallGood ? const Color(0xFF00B074) : const Color(0xFFFE2C55),
                              size: 28,
                            ),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Security Checkup',
                                  style: TextStyle(
                                    color: Color(0xFF161823),
                                    fontSize: 18,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  isOverallGood
                                      ? 'Your account meets top security standards'
                                      : 'Review recommended security actions',
                                  style: TextStyle(
                                    color: isOverallGood ? const Color(0xFF00B074) : const Color(0xFFFE2C55),
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 24),
                      if (checks.isEmpty) ...[
                        _buildSecurityAuditItem(
                          icon: Icons.lock_outline,
                          title: 'Password Security',
                          subtitle: 'Stored with salted bcrypt derivation.',
                          isGood: true,
                        ),
                        const Divider(color: Color(0xFFEBECEF)),
                        _buildSecurityAuditItem(
                          icon: Icons.devices,
                          title: 'Trusted Device Sessions',
                          subtitle: 'Active device session verified via signed JWT.',
                          isGood: true,
                        ),
                      ] else ...[
                        for (int i = 0; i < checks.length; i++) ...[
                          if (i > 0) const Divider(color: Color(0xFFEBECEF)),
                          _buildSecurityAuditItem(
                            icon: _getCheckIcon(checks[i]['key']?.toString()),
                            title: checks[i]['title']?.toString() ?? 'Security Check',
                            subtitle: checks[i]['detail']?.toString() ?? 'Verified safe.',
                            isGood: checks[i]['status'] == 'GOOD',
                          ),
                        ],
                      ],
                      const SizedBox(height: 24),
                      ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF161823),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                        onPressed: () => Navigator.pop(ctx),
                        child: const Text('Done', style: TextStyle(fontWeight: FontWeight.bold)),
                      ),
                    ],
                  );
                },
              ),
            );
          },
        );
      },
    );
  }

  IconData _getCheckIcon(String? key) {
    switch (key) {
      case 'PASSWORD':
        return Icons.lock_outline;
      case 'SESSIONS':
        return Icons.devices;
      case 'EMAIL_VERIFICATION':
        return Icons.verified_outlined;
      case 'AUDIT_TELEMETRY':
        return Icons.history_edu;
      default:
        return Icons.verified_user_outlined;
    }
  }

  Widget _buildSecurityAuditItem({
    required IconData icon,
    required String title,
    required String subtitle,
    required bool isGood,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 22, color: const Color(0xFF161823)),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(color: Color(0xFF161823), fontWeight: FontWeight.w600, fontSize: 15)),
                const SizedBox(height: 2),
                Text(subtitle, style: const TextStyle(color: Color(0xFF737373), fontSize: 12, height: 1.3)),
              ],
            ),
          ),
          const SizedBox(width: 8),
          const Icon(Icons.check_circle, color: Color(0xFF00B074), size: 20),
        ],
      ),
    );
  }

  void _showEssentialTelemetryWarning() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        title: const Text('Essential Security Telemetry', style: TextStyle(color: Color(0xFF161823), fontWeight: FontWeight.bold)),
        content: const Text(
          'Security telemetry protects your account against brute-force attacks, session hijacking, and credential stuffing. We recommend keeping it enabled.',
          style: TextStyle(color: Color(0xFF555555), fontSize: 13, height: 1.4),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Keep Enabled', style: TextStyle(color: Color(0xFF20D5EC), fontWeight: FontWeight.bold)),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              _updatePreference(securityTelemetry: false);
            },
            child: const Text('Turn Off', style: TextStyle(color: Color(0xFFFE2C55))),
          ),
        ],
      ),
    );
  }

  void _showPersonalizationSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            return SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Personalization & Preferences',
                      style: TextStyle(color: Color(0xFF161823), fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Control how News Share customizes your reading feed and collects telemetry.',
                      style: TextStyle(color: Color(0xFF737373), fontSize: 13),
                    ),
                    const SizedBox(height: 16),
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Feed Personalization', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                      subtitle: const Text('Recommends stories based on topics you read', style: TextStyle(color: Color(0xFF737373), fontSize: 12)),
                      value: _feedPersonalization,
                      activeColor: const Color(0xFF20D5EC),
                      onChanged: (val) {
                        setSheetState(() => _feedPersonalization = val);
                        _updatePreference(feedPersonalization: val);
                      },
                    ),
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Analytics & Performance', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                      subtitle: const Text('Anonymous telemetry to improve app speed and stability', style: TextStyle(color: Color(0xFF737373), fontSize: 12)),
                      value: _analyticsPerformance,
                      activeColor: const Color(0xFF20D5EC),
                      onChanged: (val) {
                        setSheetState(() => _analyticsPerformance = val);
                        _updatePreference(analyticsPerformance: val);
                      },
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  void _showPoliciesListSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return DraggableScrollableSheet(
          initialChildSize: 0.75,
          minChildSize: 0.4,
          maxChildSize: 0.9,
          expand: false,
          builder: (context, scrollController) {
            return SafeArea(
              child: Column(
                children: [
                  const SizedBox(height: 12),
                  Container(
                    height: 4,
                    width: 40,
                    decoration: BoxDecoration(
                      color: const Color(0xFFD8D9DF),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  const Padding(
                    padding: EdgeInsets.all(20),
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: Text(
                        'Terms & Legal Policies',
                        style: TextStyle(color: Color(0xFF161823), fontSize: 18, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
                  const Divider(color: Color(0xFFEBECEF), height: 1),
                  Expanded(
                    child: _policies.isEmpty
                        ? const Center(
                            child: Text('Loading policies...', style: TextStyle(color: Color(0xFF737373))),
                          )
                        : ListView.separated(
                            controller: scrollController,
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                            itemCount: _policies.length,
                            separatorBuilder: (_, __) => const Divider(color: Color(0xFFEBECEF), height: 1),
                            itemBuilder: (context, idx) {
                              final p = _policies[idx];
                              final title = p['title'] ?? 'Policy';
                              final description = p['description'] ?? 'Tap to read full terms and provisions.';

                              return ListTile(
                                contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                leading: const Icon(Icons.description_outlined, color: Color(0xFF161823), size: 22),
                                title: Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                                subtitle: Text(
                                  description,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(color: Color(0xFF737373), fontSize: 12),
                                ),
                                trailing: const Icon(Icons.chevron_right, size: 20, color: Color(0xFFB0B3BA)),
                                onTap: () => _showPolicyReader(p),
                              );
                            },
                          ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  void _showPolicyReader(Map<String, dynamic> policy) {
    final policyId = policy['id']?.toString() ?? '';
    final code = policy['code']?.toString() ?? '';
    final title = policy['title'] ?? 'Policy';
    final activeVersion = policy['activeVersion'] as Map<String, dynamic>?;
    final effectiveDate = activeVersion?['effectiveDate']?.toString().split('T').first ??
        policy['publishedAt']?.toString().split('T').first ??
        'January 1, 2025';

    final rawContent = activeVersion?['content'] ?? policy['content'] ?? policy['summary'] ?? policy['description'];
    final content = (rawContent != null && rawContent.toString().trim().isNotEmpty)
        ? rawContent.toString()
        : _getDefaultPolicyContent(code, title);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return DraggableScrollableSheet(
          initialChildSize: 0.88,
          minChildSize: 0.5,
          maxChildSize: 0.95,
          expand: false,
          builder: (context, scrollController) {
            return SafeArea(
              child: Column(
                children: [
                  const SizedBox(height: 12),
                  Container(
                    height: 4,
                    width: 40,
                    decoration: BoxDecoration(
                      color: const Color(0xFFD8D9DF),
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
                                  color: Color(0xFF161823),
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                'Effective: $effectiveDate',
                                style: const TextStyle(color: Color(0xFF737373), fontSize: 12),
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.close, color: Color(0xFF161823)),
                          onPressed: () => Navigator.pop(ctx),
                        ),
                      ],
                    ),
                  ),
                  const Divider(color: Color(0xFFEBECEF), height: 1),
                  Expanded(
                    child: SingleChildScrollView(
                      controller: scrollController,
                      padding: const EdgeInsets.all(20),
                      child: SelectableText(
                        content,
                        style: const TextStyle(
                          color: Color(0xFF2C2D32),
                          fontSize: 14,
                          height: 1.6,
                        ),
                      ),
                    ),
                  ),
                  const Divider(color: Color(0xFFEBECEF), height: 1),
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF161823),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                        onPressed: () async {
                          if (policyId.isNotEmpty) {
                            await ApiClient.instance.acceptPolicy(policyId);
                          }
                          if (ctx.mounted) Navigator.pop(ctx);
                          if (mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text('Acknowledged: $title'),
                                backgroundColor: const Color(0xFF00B074),
                              ),
                            );
                          }
                        },
                        child: const Text('Acknowledge & Accept', style: TextStyle(fontWeight: FontWeight.bold)),
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  void _showBlockedAccountsPage() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            return DraggableScrollableSheet(
              initialChildSize: 0.85,
              minChildSize: 0.5,
              maxChildSize: 0.95,
              expand: false,
              builder: (context, scrollController) {
                return SafeArea(
                  child: Column(
                    children: [
                      const SizedBox(height: 12),
                      Container(
                        height: 4,
                        width: 40,
                        decoration: BoxDecoration(
                          color: const Color(0xFFD8D9DF),
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'Blocked Accounts (${_blockedUsers.length})',
                              style: const TextStyle(color: Color(0xFF161823), fontSize: 18, fontWeight: FontWeight.bold),
                            ),
                            TextButton.icon(
                              icon: const Icon(Icons.add, size: 18, color: Color(0xFF20D5EC)),
                              label: const Text('Block Account', style: TextStyle(color: Color(0xFF20D5EC), fontWeight: FontWeight.bold)),
                              onPressed: () => _showBlockSearchDialog(setSheetState),
                            ),
                          ],
                        ),
                      ),
                      const Divider(color: Color(0xFFEBECEF), height: 1),
                      Expanded(
                        child: _blockedUsers.isEmpty
                            ? Center(
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: const [
                                    Icon(Icons.block, size: 48, color: Color(0xFFB0B3BA)),
                                    SizedBox(height: 12),
                                    Text('No blocked accounts', style: TextStyle(color: Color(0xFF161823), fontWeight: FontWeight.bold, fontSize: 15)),
                                    SizedBox(height: 4),
                                    Text('Blocked people cannot message you or view your posts.', style: TextStyle(color: Color(0xFF737373), fontSize: 13)),
                                  ],
                                ),
                              )
                            : ListView.separated(
                                controller: scrollController,
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                                itemCount: _blockedUsers.length,
                                separatorBuilder: (_, __) => const Divider(color: Color(0xFFEBECEF), height: 1),
                                itemBuilder: (context, idx) {
                                  final b = _blockedUsers[idx];
                                  final blocked = b['blocked'] as Map<String, dynamic>?;
                                  final username = blocked?['username'] ?? 'user';
                                  final fullName = blocked?['fullName'] ?? '';
                                  final blockedId = b['blockedId'] ?? blocked?['id'] ?? '';

                                  return ListTile(
                                    contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                    leading: CircleAvatar(
                                      backgroundColor: const Color(0xFFEBECEF),
                                      child: Text(
                                        username.isNotEmpty ? username[0].toUpperCase() : 'U',
                                        style: const TextStyle(color: Color(0xFF161823), fontWeight: FontWeight.bold),
                                      ),
                                    ),
                                    title: Text('@$username', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                                    subtitle: fullName.isNotEmpty
                                        ? Text(fullName, style: const TextStyle(color: Color(0xFF737373), fontSize: 12))
                                        : null,
                                    trailing: OutlinedButton(
                                      style: OutlinedButton.styleFrom(
                                        side: const BorderSide(color: Color(0xFFD8D9DF)),
                                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                      ),
                                      onPressed: () async {
                                        await ApiClient.instance.unblockUser(blockedId);
                                        setState(() {
                                          _blockedUsers.removeWhere((item) => item['blockedId'] == blockedId);
                                        });
                                        setSheetState(() {});
                                      },
                                      child: const Text('Unblock', style: TextStyle(color: Color(0xFF161823), fontSize: 12, fontWeight: FontWeight.w600)),
                                    ),
                                  );
                                },
                              ),
                      ),
                    ],
                  ),
                );
              },
            );
          },
        );
      },
    );
  }

  void _showBlockSearchDialog(StateSetter setSheetState) {
    final searchController = TextEditingController();
    List<Map<String, dynamic>> searchResults = [];
    bool isSearching = false;

    showDialog(
      context: context,
      builder: (dialogCtx) => StatefulBuilder(
        builder: (context, setDialogState) {
          return AlertDialog(
            backgroundColor: Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            title: const Text('Block an Account', style: TextStyle(color: Color(0xFF161823), fontWeight: FontWeight.bold, fontSize: 17)),
            content: SizedBox(
              width: double.maxFinite,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: searchController,
                    decoration: InputDecoration(
                      hintText: 'Search username...',
                      hintStyle: const TextStyle(color: Color(0xFF737373)),
                      prefixIcon: const Icon(Icons.search, color: Color(0xFF737373)),
                      filled: true,
                      fillColor: const Color(0xFFF8F8FA),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                    ),
                    onSubmitted: (q) async {
                      if (q.trim().isEmpty) return;
                      setDialogState(() => isSearching = true);
                      try {
                        final users = await ApiClient.instance.searchUsers(q.trim());
                        setDialogState(() {
                          searchResults = users;
                          isSearching = false;
                        });
                      } catch (_) {
                        setDialogState(() => isSearching = false);
                      }
                    },
                  ),
                  const SizedBox(height: 12),
                  if (isSearching)
                    const Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator(color: Color(0xFF20D5EC)))
                  else if (searchResults.isNotEmpty)
                    SizedBox(
                      height: 180,
                      child: ListView.builder(
                        itemCount: searchResults.length,
                        itemBuilder: (ctx, idx) {
                          final u = searchResults[idx];
                          final uId = u['id']?.toString() ?? '';
                          final uName = u['username']?.toString() ?? '';
                          return ListTile(
                            title: Text('@$uName', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                            trailing: ElevatedButton(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFFFE2C55),
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              ),
                              onPressed: () async {
                                Navigator.pop(dialogCtx);
                                await ApiClient.instance.blockUser(uId);
                                await _loadAllPrivacyData();
                                setSheetState(() {});
                              },
                              child: const Text('Block', style: TextStyle(fontSize: 12)),
                            ),
                          );
                        },
                      ),
                    ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogCtx),
                child: const Text('Cancel', style: TextStyle(color: Color(0xFF737373))),
              ),
            ],
          );
        },
      ),
    );
  }

  void _showDataExportDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Download Your Data', style: TextStyle(color: Color(0xFF161823), fontWeight: FontWeight.bold)),
        content: const Text(
          'In accordance with Article 24 of Ethiopian Personal Data Protection Proclamation No. 1321/2024, you have the right to receive a structured machine-readable export of your personal data archive, posts, comments, and profile information.',
          style: TextStyle(color: Color(0xFF555555), fontSize: 13, height: 1.4),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel', style: TextStyle(color: Color(0xFF737373))),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF161823),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () async {
              Navigator.pop(ctx);
              try {
                final res = await ApiClient.instance.exportMyData();
                if (mounted) {
                  showDialog(
                    context: context,
                    builder: (alertCtx) => AlertDialog(
                      backgroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      title: const Text('Data Archive Ready', style: TextStyle(color: Color(0xFF161823), fontWeight: FontWeight.bold)),
                      content: Text(
                        'Your statutory data archive (JSON format) has been generated successfully.\nRecords exported: ${res['profile'] != null ? 'Profile, Content, & Logs' : 'Complete User Archive'}.',
                        style: const TextStyle(color: Color(0xFF555555), fontSize: 13),
                      ),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.pop(alertCtx),
                          child: const Text('Done', style: TextStyle(color: Color(0xFF20D5EC), fontWeight: FontWeight.bold)),
                        ),
                      ],
                    ),
                  );
                }
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Export failed: $e'), backgroundColor: const Color(0xFFFE2C55)),
                  );
                }
              }
            },
            child: const Text('Request Archive', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  void _handleAccountDeletionAction() {
    if (_activeDeletionRequest != null) {
      _cancelDeletion();
      return;
    }

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Delete Account?', style: TextStyle(color: Color(0xFFFE2C55), fontWeight: FontWeight.bold)),
        content: const Text(
          'Your account will be deactivated immediately and permanently erased after a 30-day security grace period. You can sign in and cancel at any point within the 30 days.',
          style: TextStyle(color: Color(0xFF555555), fontSize: 13, height: 1.4),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Keep Account', style: TextStyle(color: Color(0xFF737373))),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFFE2C55),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () async {
              Navigator.pop(ctx);
              try {
                await ApiClient.instance.createPrivacyRequest(
                  requestType: 'ACCOUNT_DELETION',
                  details: 'User requested account erasure with statutory 30-day grace period.',
                );
                await _loadAllPrivacyData();
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Account deletion scheduled (30-day grace period active).'),
                      backgroundColor: Color(0xFFFE2C55),
                    ),
                  );
                }
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Failed: $e'), backgroundColor: const Color(0xFFFE2C55)),
                  );
                }
              }
            },
            child: const Text('Schedule Deletion', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  Future<void> _cancelDeletion() async {
    try {
      await ApiClient.instance.cancelAccountDeletion(reason: 'User cancelled deletion from mobile privacy settings.');
      await _loadAllPrivacyData();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Account deletion cancelled. Your account remains active.'),
            backgroundColor: Color(0xFF00B074),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to cancel deletion: $e'), backgroundColor: const Color(0xFFFE2C55)),
        );
      }
    }
  }

  // ===================== DEFAULT STATUTORY POLICY TEXTS =====================

  String _getDefaultPolicyContent(String code, String title) {
    final upperCode = code.toUpperCase();
    final lowerTitle = title.toLowerCase();

    if (upperCode.contains('PRIVACY') || lowerTitle.contains('privacy')) {
      return '''News Share Privacy Policy
Effective: January 1, 2025 • Version 2.0
Governed by: Ethiopian Personal Data Protection Proclamation No. 1321/2024

Welcome to News Share. We are committed to protecting your personal data, safeguarding your privacy rights, and maintaining strict transparency regarding our data processing activities.

01. Data We Collect
• Account Identifiers: Username, email address, password hash (salted bcrypt), and optional biography and profile avatar.
• News & Community Content: News articles, comments, reactions, saved articles, and follows that you publish or interact with.
• Device & Security Telemetry: IP address, authentication timestamps, user-agent metadata, and security audit logs required to prevent unauthorized access and bot attacks.

02. Legal Basis for Processing
We process personal data pursuant to Proclamation No. 1321/2024 under the following lawful bases:
• Contractual Necessity: To provide news sharing, social feeds, and profile management.
• Explicit Consent: For optional personalized content recommendations and diagnostic telemetry.
• Legal Obligation: For maintaining append-only security audit trails and incident reporting records.

03. Data Subject Statutory Rights
Under Proclamation No. 1321/2024, you possess statutory rights:
• Right of Access & Portability (Art. 24): Download a full, machine-readable JSON archive of your personal data at any time via Settings > Privacy > Download your data.
• Right to Rectification (Art. 25): Update or correct any incomplete information in your profile.
• Right to Erasure (Art. 26): Schedule complete account deletion with a 30-day security grace period.
• Right to Object & Restrict Processing (Art. 27 & 28): Withdraw consent for algorithm personalization and analytics without impacting basic service availability.

04. Data Retention & Safeguards
• Personal accounts scheduled for deletion enter a mandatory 30-day security grace period to allow account recovery. After 30 days, personal data is permanently wiped.
• Security telemetry is retained for 365 days in tamper-evident logs before automated archival.

05. Contact Data Protection Officer
For inquiries or supervisory escalations, contact dpo@newsshare.app.''';
    }

    if (upperCode.contains('TERMS') || lowerTitle.contains('terms')) {
      return '''News Share Terms of Service
Effective: January 1, 2025 • Version 2.0

Please read these Terms of Service carefully before accessing or publishing on News Share. By using our platform, you agree to these legally binding terms.

01. Eligibility & Account Integrity
• You must be at least 13 years of age to register an account.
• You are responsible for safeguarding your login credentials. Do not share your password or session tokens with third parties.

02. Content Standards & Intellectual Property
• Journalistic Responsibility: Users publishing news stories must strive for factual accuracy and respect copyright protections.
• Prohibited Content: Hate speech, harassment, violent incitement, defamation, and disinformation campaigns are strictly prohibited and will result in account suspension.
• Licensing: You retain ownership of content you post. By posting, you grant News Share a non-exclusive license to display your posts to followers and readers across our network.

03. Account Deletion & Termination
You may terminate your account at any time via Settings > Privacy > Delete account. We reserve the right to suspend accounts that violate community safety rules or terms of service.''';
    }

    if (upperCode.contains('COOKIE') || lowerTitle.contains('cookie') || lowerTitle.contains('storage')) {
      return '''News Share Cookie & Local Storage Policy
Effective: January 1, 2025 • Version 2.0

01. Purpose of Local Storage
News Share utilizes device local storage (EncryptedSharedPreferences / Keychain) exclusively for essential operation:
• Authentication Tokens: Cryptographically signed JWT access tokens and refresh tokens to keep you logged in safely.
• Client Cache: Profile metadata and preferences cached locally for offline feed speed.

02. Zero Third-Party Advertising Trackers
We do not use third-party tracking pixels or sell your activity data to data brokers.''';
    }

    if (upperCode.contains('GUIDELINE') || lowerTitle.contains('community')) {
      return '''News Share Community Guidelines
Effective: January 1, 2025 • Version 2.0

01. Accurate Reporting & Source Attribution
• Verify facts before publishing breaking news.
• Cite original sources when reporting external news.

02. Respectful Discourse
• Personal abuse, hate speech, and harassment are prohibited.
• Coordinated disinformation will result in immediate bans.''';
    }

    if (upperCode.contains('DPA') || lowerTitle.contains('processing')) {
      return '''Data Processing & Technical Safeguards Policy
Effective: January 1, 2025 • Version 2.0

01. Cryptographic Security Standards
• Encryption in Transit: Enforced TLS 1.3 with modern cipher suites.
• Encryption at Rest: AES-256 database volume encryption.
• Passwords: Salted bcrypt key derivation.

02. 72-Hour Breach Notification
In accordance with Article 33 of Proclamation No. 1321/2024, verified security incidents will be reported to users within 72 hours.''';
    }

    return 'Official policy provisions and security standards for $title.';
  }
}
