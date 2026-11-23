import 'package:flutter/material.dart';

class PrivacyPolicyPage extends StatelessWidget {
  const PrivacyPolicyPage({super.key});

  static const Color authflowBlue = Color(0xFF008FF5);
  static const Color textPrimary = Color(0xFF111827);
  static const Color textSecondary = Color(0xFF4B5563);
  static const Color bgSurface = Color(0xFFF9FAFB);
  static const Color borderColor = Color(0xFFE5E7EB);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 1,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 20, color: textPrimary),
          onPressed: () => Navigator.pop(context),
          tooltip: 'Back to Log In',
        ),
        title: const Text(
          'Privacy Policy',
          style: TextStyle(
            color: textPrimary,
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
        centerTitle: true,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header Badge & Title
              Center(
                child: Column(
                  children: [
                    Container(
                      width: 56,
                      height: 56,
                      decoration: BoxDecoration(
                        color: authflowBlue.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: authflowBlue.withOpacity(0.2)),
                      ),
                      child: const Icon(
                        Icons.shield_outlined,
                        color: authflowBlue,
                        size: 30,
                      ),
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'Authflow Privacy Policy',
                      style: TextStyle(
                        color: textPrimary,
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        letterSpacing: -0.5,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'Effective: January 1, 2025 • Version 2.4',
                      style: TextStyle(color: textSecondary, fontSize: 13),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Highlight Callout Banner
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: bgSurface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: borderColor),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    Icon(Icons.verified_user_outlined, color: authflowBlue, size: 22),
                    SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Your privacy and digital rights are paramount. Authflow adheres to strict data protection standards and the Ethiopian Personal Data Protection Proclamation No. 1321/2024.',
                        style: TextStyle(
                          color: textPrimary,
                          fontSize: 13,
                          height: 1.45,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Section 1: Introduction
              _buildSection(
                number: '01',
                title: 'Introduction & Scope',
                body:
                    'This Privacy Policy describes how Authflow ("we", "our", or "the Platform"), operating within the News Share ecosystem, collects, processes, protects, and handles your personal data when you create an account, authenticate, publish news, or interact with our services.',
              ),

              // Section 2: Information We Collect
              _buildSection(
                number: '02',
                title: 'Information We Collect',
                body:
                    'We gather only the minimum data required to provide a reliable, secure user experience:',
                bullets: const [
                  'Account Credentials: Email address, username, securely hashed password (bcrypt), and authentication tokens (JWT).',
                  'Profile Information: Full name, bio, profile photo/avatar URL, follower and following connections.',
                  'User Content: Articles, stories, reels, comments, reactions, upvotes, and saved bookmarks.',
                  'Safety & Telemetry Data: IP address, device user-agent, session timestamps, and security audit logs strictly used for intrusion prevention.',
                ],
              ),

              // Section 3: Biometric Authentication Notice
              _buildHighlightBox(
                icon: Icons.fingerprint,
                title: 'Biometric Authentication Privacy',
                description:
                    'When you enable Fingerprint or Face Authentication, biometric verification is executed entirely on your local device hardware using the Android BiometricPrompt security enclave. Authflow never receives, processes, transmits, or stores your raw biometric templates or fingerprint scans on any external server.',
              ),
              const SizedBox(height: 24),

              // Section 4: How We Use Your Data
              _buildSection(
                number: '03',
                title: 'How We Use Your Data',
                body: 'Your information is processed for legitimate operational purposes:',
                bullets: const [
                  'To authenticate your identity, prevent credential stuffing, and safeguard account access.',
                  'To deliver your news feed, stories, reels, and user notifications.',
                  'To process and record user consent choices and privacy rights requests.',
                  'To enforce community guidelines, investigate security incidents, and maintain tamper-evident audit trails.',
                  'We NEVER sell, rent, or trade your personal data to third-party data brokers or advertisers.',
                ],
              ),

              // Section 5: Legal Compliance
              _buildSection(
                number: '04',
                title: 'Legal Basis & Data Subject Rights',
                body:
                    'Under applicable privacy statutes, including Ethiopian Proclamation No. 1321/2024, you hold complete autonomy over your personal information:',
                bullets: const [
                  'Right of Access: Export a complete, machine-readable JSON archive of your personal profile, posts, comments, and consents at any time in Settings.',
                  'Right to Rectification: Correct inaccurate or outdated details directly in your profile or submit an official rectification request.',
                  'Right to Erasure (Account Deletion): Request permanent deletion. Accounts undergo an administrative 30-day security grace period before permanent anonymization.',
                  'Right to Restrict & Withdraw Consent: Toggle off optional telemetry, personalization, and marketing in your privacy preferences.',
                ],
              ),

              // Section 6: Security & Encryption
              _buildSection(
                number: '05',
                title: 'Data Security & Storage',
                body:
                    'We implement industry-standard cryptographic defenses including TLS 1.3 encryption in transit, salted bcrypt password hashing, role-based access control (RBAC), and immutable administrative audit logs that capture every security and moderation action with actor, target, timestamp, and justification.',
              ),

              // Section 7: Third-Party Services
              _buildSection(
                number: '06',
                title: 'Third-Party Services',
                body:
                    'When you choose "Continue with Google", we receive your verified Google account email, name, and profile picture strictly to initialize or link your Authflow account. We do not obtain access to your Google Drive, contacts, or external Google services.',
              ),

              // Section 8: Contact
              _buildSection(
                number: '07',
                title: 'Contact Our Data Protection Officer',
                body:
                    'If you have questions regarding this Privacy Policy, your legal rights, or wish to report a privacy concern, please reach out directly:',
              ),

              Container(
                margin: const EdgeInsets.only(top: 8, bottom: 24),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: bgSurface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: borderColor),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    Text(
                      'Authflow Privacy & Governance Office',
                      style: TextStyle(fontWeight: FontWeight.bold, color: textPrimary, fontSize: 14),
                    ),
                    SizedBox(height: 4),
                    Text('Data Protection Officer (DPO)', style: TextStyle(color: textSecondary, fontSize: 13)),
                    SizedBox(height: 4),
                    Text('Email: dpo@authflow.app / compliance@newsshare.internal',
                        style: TextStyle(color: authflowBlue, fontWeight: FontWeight.w600, fontSize: 13)),
                    SizedBox(height: 4),
                    Text('Response Time: Within 72 business hours',
                        style: TextStyle(color: textSecondary, fontSize: 12)),
                  ],
                ),
              ),

              // Bottom Return Button
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: authflowBlue,
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  onPressed: () => Navigator.pop(context),
                  child: const Text(
                    'I Understand',
                    style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w600),
                  ),
                ),
              ),
              const SizedBox(height: 24),
              const Center(
                child: Text(
                  '© 2025 Authflow • All rights reserved.',
                  style: TextStyle(color: Color(0xFF9CA3AF), fontSize: 12),
                ),
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSection({
    required String number,
    required String title,
    required String body,
    List<String>? bullets,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 22),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                number,
                style: const TextStyle(
                  color: authflowBlue,
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.5,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                title,
                style: const TextStyle(
                  color: textPrimary,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            body,
            style: const TextStyle(color: textSecondary, fontSize: 14, height: 1.55),
          ),
          if (bullets != null) ...[
            const SizedBox(height: 10),
            ...bullets.map(
              (bullet) => Padding(
                padding: const EdgeInsets.only(bottom: 8, left: 4),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      margin: const EdgeInsets.only(top: 6, right: 10),
                      width: 5,
                      height: 5,
                      decoration: const BoxDecoration(
                        color: authflowBlue,
                        shape: BoxShape.circle,
                      ),
                    ),
                    Expanded(
                      child: Text(
                        bullet,
                        style: const TextStyle(color: textSecondary, fontSize: 13.5, height: 1.45),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildHighlightBox({
    required IconData icon,
    required String title,
    required String description,
  }) {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 4),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFEFF6FF),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFBFDBFE)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: authflowBlue, size: 24),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    color: textPrimary,
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  description,
                  style: const TextStyle(
                    color: textSecondary,
                    fontSize: 13,
                    height: 1.45,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
