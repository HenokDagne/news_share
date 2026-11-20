import 'package:flutter/material.dart';
import '../../services/api_client.dart';

class AccountStatusScreen extends StatelessWidget {
  final String status; // 'ACCOUNT_BANNED', 'ACCOUNT_SUSPENDED', 'ACCOUNT_DEACTIVATED'
  final Map<String, dynamic>? restriction;

  const AccountStatusScreen({
    super.key,
    required this.status,
    this.restriction,
  });

  @override
  Widget build(BuildContext context) {
    final isPermanent = restriction?['permanent'] == true || status == 'ACCOUNT_BANNED';
    final isSuspended = status == 'ACCOUNT_SUSPENDED';
    final publicReason = restriction?['publicReason']?.toString() ?? 'Violation of Community Guidelines';
    final expiresAtStr = restriction?['expiresAt']?.toString();
    final appealContact = restriction?['appealContact']?.toString() ?? 'support@newsshare.com';

    String title = 'Account Restricted';
    String message = 'Your account has been restricted by platform moderation.';
    Color accentColor = const Color(0xFFFE2C55);

    if (status == 'ACCOUNT_BANNED') {
      title = 'Your Account is Banned';
      message = 'This permanent ban was enacted due to severe or repeated violations.';
      accentColor = const Color(0xFFE53935);
    } else if (isSuspended) {
      title = 'Your Account is Suspended';
      message = 'Your access is temporarily suspended.';
      accentColor = const Color(0xFFFB8C00);
    } else if (status == 'ACCOUNT_DEACTIVATED') {
      title = 'Account Deactivated';
      message = 'Your account has been placed on hold.';
      accentColor = Colors.grey.shade700;
    }

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              const Spacer(),

              // Icon
              Container(
                height: 80,
                width: 80,
                decoration: BoxDecoration(
                  color: accentColor.withOpacity(0.12),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  isPermanent ? Icons.block_rounded : Icons.lock_clock_rounded,
                  size: 42,
                  color: accentColor,
                ),
              ),
              const SizedBox(height: 24),

              // Title
              Text(
                title,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  color: Colors.black87,
                ),
              ),
              const SizedBox(height: 10),

              // Subtitle
              Text(
                message,
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 14, color: Colors.grey.shade600),
              ),
              const SizedBox(height: 24),

              // Restriction Detail Card
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFFF9FAFB),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: Colors.grey.shade200),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Reason for sanction:',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Colors.grey.shade500,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      publicReason,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                        color: Colors.black87,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'Sanction duration:',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Colors.grey.shade500,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      isPermanent
                          ? 'Permanent (Does not expire)'
                          : expiresAtStr != null
                              ? 'Access returns on: ${DateTime.tryParse(expiresAtStr)?.toLocal().toString().split(".")[0] ?? expiresAtStr}'
                              : 'Temporary suspension',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        color: accentColor,
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 20),

              // Appeal contact notice
              Text(
                'If you believe this was an error, contact our appeals desk at:\n$appealContact',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12, color: Colors.grey.shade500),
              ),

              const Spacer(),

              // Back to Sign In
              SizedBox(
                width: double.infinity,
                height: 48,
                child: OutlinedButton(
                  style: OutlinedButton.styleFrom(
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                    side: BorderSide(color: Colors.grey.shade400),
                  ),
                  onPressed: () async {
                    await ApiClient.instance.logout();
                    if (context.mounted) {
                      Navigator.pushNamedAndRemoveUntil(context, '/login', (route) => false);
                    }
                  },
                  child: const Text(
                    'Back to Sign In',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: Colors.black87,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
