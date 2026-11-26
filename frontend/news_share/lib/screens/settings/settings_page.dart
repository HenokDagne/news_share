import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';

import '../../services/api_client.dart';
import '../privacy/privacy_and_safety_screen.dart';
import '../profile/profile_page.dart';
import '../notification/notification_page.dart';
import '../activity/activity_page.dart';
import '../auth/login.dart';

class SettingsAndPrivacyPage extends StatelessWidget {
  const SettingsAndPrivacyPage({super.key});

  void _handleBackNavigation(BuildContext context) {
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

    return Scaffold(
      backgroundColor: bgColor,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0.5,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: primaryTextColor, size: 22),
          onPressed: () => _handleBackNavigation(context),
        ),
        title: const Text(
          'Settings and privacy',
          style: TextStyle(
            color: primaryTextColor,
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
        centerTitle: false,
      ),
      body: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        children: [
          // 1. ACCOUNT
          _buildSectionHeader('Account', secondaryTextColor),
          _buildSettingsCard(
            cardColor: cardColor,
            dividerColor: dividerColor,
            children: [
              _buildSettingTile(
                icon: Icons.person_outline,
                title: 'Account',
                textColor: primaryTextColor,
                onTap: () {
                  if (Navigator.of(context).canPop()) {
                    Navigator.of(context).pop();
                  } else {
                    Navigator.pushReplacement(
                      context,
                      MaterialPageRoute(builder: (_) => const ProfilePage()),
                    );
                  }
                },
              ),
              _buildSettingTile(
                icon: Icons.lock_outline,
                title: 'Privacy',
                textColor: primaryTextColor,
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const PrivacyAndSafetyScreen()),
                  );
                },
              ),
              _buildSettingTile(
                icon: Icons.shield_outlined,
                title: 'Security and permissions',
                textColor: primaryTextColor,
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const PrivacyAndSafetyScreen()),
                  );
                },
              ),
              _buildSettingTile(
                icon: Icons.share_outlined,
                title: 'Share profile',
                textColor: primaryTextColor,
                isLast: true,
                onTap: () => _shareProfile(context),
              ),
            ],
          ),

          const SizedBox(height: 24),

          // 2. CONTENT & DISPLAY
          _buildSectionHeader('Content & display', secondaryTextColor),
          _buildSettingsCard(
            cardColor: cardColor,
            dividerColor: dividerColor,
            children: [
              _buildSettingTile(
                icon: Icons.notifications_none,
                title: 'Notifications',
                textColor: primaryTextColor,
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const NotificationPage()),
                  );
                },
              ),
              _buildSettingTile(
                icon: Icons.live_tv_outlined,
                title: 'LIVE',
                textColor: primaryTextColor,
                onTap: () {
                  _showFeatureDialog(
                    context: context,
                    title: 'LIVE Broadcasts',
                    message:
                        'Real-time news broadcasts and audio rooms are accessible for verified reporters and accredited media organizations. Check your dashboard to submit press credentials.',
                  );
                },
              ),
              _buildSettingTile(
                icon: Icons.history,
                title: 'Activity centre',
                textColor: primaryTextColor,
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const ActivityPage()),
                  );
                },
              ),
              _buildSettingTile(
                icon: Icons.video_camera_back_outlined,
                title: 'Content preferences',
                textColor: primaryTextColor,
                onTap: () => _showContentPreferences(context),
              ),
              _buildSettingTile(
                icon: Icons.group_outlined,
                title: 'Audience controls',
                textColor: primaryTextColor,
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const PrivacyAndSafetyScreen()),
                  );
                },
              ),
              _buildSettingTile(
                icon: Icons.campaign_outlined,
                title: 'Ads',
                textColor: primaryTextColor,
                onTap: () {
                  _showFeatureDialog(
                    context: context,
                    title: 'Advertising Transparency',
                    message:
                        'News Share complies strictly with Ethiopian Personal Data Protection Proclamation No. 1321/2024. Your news reading habits are never sold to third-party ad brokers.',
                  );
                },
              ),
              _buildSettingTile(
                icon: Icons.play_circle_outline,
                title: 'Playback',
                textColor: primaryTextColor,
                isLast: true,
                onTap: () => _showPlaybackSettings(context),
              ),
            ],
          ),

          const SizedBox(height: 24),

          // 3. LOGIN & SESSION
          _buildSectionHeader('Login & Session', secondaryTextColor),
          _buildSettingsCard(
            cardColor: cardColor,
            dividerColor: dividerColor,
            children: [
              _buildSettingTile(
                icon: Icons.bookmark_outline,
                title: 'Saved posts',
                textColor: primaryTextColor,
                onTap: () {
                  Navigator.pop(context);
                },
              ),
              _buildSettingTile(
                icon: Icons.qr_code_2,
                title: 'QR code',
                textColor: primaryTextColor,
                onTap: () => _showQrCodeDialog(context),
              ),
              _buildSettingTile(
                icon: Icons.logout,
                title: 'Log out',
                textColor: const Color(0xFFFE2C55),
                isLast: true,
                onTap: () => _confirmLogout(context),
              ),
            ],
          ),

          const SizedBox(height: 36),
          Center(
            child: Text(
              'News Share v2.4.0 • Compliant with Proclamation No. 1321/2024',
              style: TextStyle(color: secondaryTextColor.withOpacity(0.7), fontSize: 11),
            ),
          ),
          const SizedBox(height: 20),
        ],
      ),
    );
  }

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

  Widget _buildSettingTile({
    required IconData icon,
    required String title,
    required Color textColor,
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
            children: [
              Icon(icon, color: textColor, size: 21),
              const SizedBox(width: 14),
              Expanded(
                child: Text(
                  title,
                  style: TextStyle(
                    color: textColor,
                    fontSize: 15,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
              const Icon(
                Icons.chevron_right,
                color: Color(0xFFB0B3BA),
                size: 20,
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _shareProfile(BuildContext context) {
    final username = ApiClient.instance.currentUsername ?? 'user';
    final shareUrl = 'https://newsshare.app/@$username';
    try {
      Share.share('Check out @$username on News Share: $shareUrl');
    } catch (_) {
      Clipboard.setData(ClipboardData(text: shareUrl));
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Profile link copied to clipboard!'),
          backgroundColor: Color(0xFF20D5EC),
        ),
      );
    }
  }

  void _showFeatureDialog({
    required BuildContext context,
    required String title,
    required String message,
  }) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(title, style: const TextStyle(color: Color(0xFF161823), fontSize: 17, fontWeight: FontWeight.bold)),
        content: Text(message, style: const TextStyle(color: Color(0xFF555555), fontSize: 13, height: 1.4)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('OK', style: TextStyle(color: Color(0xFF20D5EC), fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  void _showContentPreferences(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Content Preferences',
                style: TextStyle(color: Color(0xFF161823), fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              const Text(
                'Personalize the news feed according to your language and editorial interests.',
                style: TextStyle(color: Color(0xFF737373), fontSize: 13),
              ),
              const SizedBox(height: 16),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.language, color: Color(0xFF161823)),
                title: const Text('Languages', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                subtitle: const Text('Amharic, Afaan Oromoo, Tigrinya, English', style: TextStyle(color: Color(0xFF737373), fontSize: 12)),
                trailing: const Icon(Icons.chevron_right, size: 20, color: Color(0xFFB0B3BA)),
                onTap: () => Navigator.pop(ctx),
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.tune, color: Color(0xFF161823)),
                title: const Text('Keyword Filters', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                subtitle: const Text('Mute specific topics or tags', style: TextStyle(color: Color(0xFF737373), fontSize: 12)),
                trailing: const Icon(Icons.chevron_right, size: 20, color: Color(0xFFB0B3BA)),
                onTap: () => Navigator.pop(ctx),
              ),
            ],
          ),
        );
      },
    );
  }

  void _showPlaybackSettings(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Playback & Data',
                style: TextStyle(color: Color(0xFF161823), fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 16),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Autoplay videos', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                subtitle: const Text('Autoplay on Wi-Fi and mobile data', style: TextStyle(color: Color(0xFF737373), fontSize: 12)),
                value: true,
                activeColor: const Color(0xFF20D5EC),
                onChanged: (_) {},
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Data Saver', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                subtitle: const Text('Reduce video resolution to preserve bandwidth', style: TextStyle(color: Color(0xFF737373), fontSize: 12)),
                value: false,
                activeColor: const Color(0xFF20D5EC),
                onChanged: (_) {},
              ),
            ],
          ),
        );
      },
    );
  }

  void _showQrCodeDialog(BuildContext context) {
    final username = ApiClient.instance.currentUsername ?? 'user';
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('@$username', textAlign: TextAlign.center, style: const TextStyle(color: Color(0xFF161823), fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFFF8F8FA),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFEBECEF)),
              ),
              child: const Icon(Icons.qr_code_2, size: 140, color: Color(0xFF161823)),
            ),
            const SizedBox(height: 12),
            const Text('Scan with camera to view profile', style: TextStyle(color: Color(0xFF737373), fontSize: 12)),
          ],
        ),
        actions: [
          Center(
            child: TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Done', style: TextStyle(color: Color(0xFF20D5EC), fontWeight: FontWeight.bold)),
            ),
          ),
        ],
      ),
    );
  }

  void _confirmLogout(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Log out?', style: TextStyle(color: Color(0xFF161823), fontWeight: FontWeight.bold)),
        content: const Text(
          'Are you sure you want to log out of your News Share account on this device?',
          style: TextStyle(color: Color(0xFF555555), fontSize: 13, height: 1.4),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel', style: TextStyle(color: Color(0xFF737373))),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFFE2C55),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () async {
              Navigator.pop(ctx);
              await ApiClient.instance.logout();
              if (context.mounted) {
                Navigator.pushAndRemoveUntil(
                  context,
                  MaterialPageRoute(builder: (_) => const LoginPage()),
                  (route) => false,
                );
              }
            },
            child: const Text('Log out', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }
}
