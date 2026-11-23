import 'package:flutter/material.dart';

class TermsOfServicePage extends StatelessWidget {
  const TermsOfServicePage({super.key});

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
          'Terms of Service',
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
                        Icons.gavel_outlined,
                        color: authflowBlue,
                        size: 30,
                      ),
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'Authflow Terms of Service',
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
                    Icon(Icons.info_outline, color: authflowBlue, size: 22),
                    SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Please read these Terms carefully. By accessing or using Authflow and the News Share platform, you agree to be bound by these legal conditions.',
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

              // Section 1
              _buildSection(
                number: '01',
                title: 'Acceptance & Eligibility',
                body:
                    'By registering an account, authenticating via email, password, biometrics, or Google OAuth, or by browsing content on Authflow / News Share, you affirm that you are at least 13 years old (or the legal age of digital consent in your jurisdiction) and legally capable of entering into this agreement.',
              ),

              // Section 2
              _buildSection(
                number: '02',
                title: 'Account Registration & Credential Security',
                body: 'You are responsible for safeguarding your credentials:',
                bullets: const [
                  'You must provide accurate and complete registration information and keep your email address updated.',
                  'You are solely responsible for all activities that occur under your account.',
                  'You must immediately report any suspected unauthorized access or account compromise to security@newsshare.internal.',
                  'Sharing account credentials, automated bot account creation, and impersonating other individuals or entities are strictly prohibited.',
                ],
              ),

              // Section 3
              _buildHighlightBox(
                icon: Icons.security_outlined,
                title: 'Acceptable Use Policy (AUP)',
                description:
                    'News Share is built upon authentic journalism and constructive community dialogue. We enforce zero tolerance for violence incitement, hate speech, harassment, sexually explicit material, copyright infringement, malicious disinformation, and automated vulnerability exploitation.',
              ),
              const SizedBox(height: 24),

              // Section 4
              _buildSection(
                number: '03',
                title: 'User Content & Licensing',
                body: 'Your content belongs to you:',
                bullets: const [
                  'You retain all intellectual property rights and copyright to news articles, stories, reels, comments, and media you submit.',
                  'By publishing content on the platform, you grant Authflow and News Share a worldwide, royalty-free, non-exclusive license to host, display, distribute, and format your content for platform operation.',
                  'You represent and warrant that you hold all necessary rights, licenses, and permissions for any third-party media or text included in your submissions.',
                ],
              ),

              // Section 5
              _buildSection(
                number: '04',
                title: 'Moderation, Reporting & Sanctions',
                body:
                    'We operate a comprehensive moderation and security review system to keep the community safe:',
                bullets: const [
                  'Users may report abusive content, violations, or accounts directly within the app.',
                  'Our compliance officers and automated safety filters investigate violations and enforce graduated sanctions, including formal warnings, post removal, temporary feature restrictions, and permanent account bans.',
                  'All administrative sanctions are recorded in immutable, tamper-evident audit logs to ensure accountability and fairness.',
                ],
              ),

              // Section 6
              _buildSection(
                number: '05',
                title: 'Account Deletion & Data Retention',
                body:
                    'You may request account deletion at any time in Settings. In accordance with security governance and fraud prevention requirements, account records enter a 30-day grace retention window prior to permanent cryptographic deletion and anonymization.',
              ),

              // Section 7
              _buildSection(
                number: '06',
                title: 'Disclaimers & Limitation of Liability',
                body:
                    'Authflow and News Share are provided on an "AS IS" and "AS AVAILABLE" basis. To the maximum extent permitted by applicable law, we disclaim all warranties, express or implied, including merchantability and fitness for a particular purpose. In no event shall Authflow be liable for indirect, incidental, punitive, or consequential damages arising from service usage.',
              ),

              // Section 8
              _buildSection(
                number: '07',
                title: 'Governing Law & Disputes',
                body:
                    'These Terms shall be governed and interpreted in accordance with the applicable laws of the Federal Democratic Republic of Ethiopia and international commercial standards. Any dispute arising from these Terms shall be resolved through good-faith negotiation, followed by binding arbitration if unresolved.',
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
                    'I Accept the Terms',
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
