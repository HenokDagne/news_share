import 'package:flutter/material.dart';
import '../privacy_policy_page.dart';
import '../terms_of_service_page.dart';

class LoginFooter extends StatelessWidget {
  const LoginFooter({super.key});

  void _showCookiesDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: const [
            Icon(Icons.cookie_outlined, color: Color(0xFF008FF5)),
            SizedBox(width: 10),
            Text('Cookies & Storage', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF111827))),
          ],
        ),
        content: const Text(
          'Authflow uses essential local storage and session tokens (JWT) strictly for secure user authentication, remembering your session preferences, and protecting against CSRF attacks. We do not use third-party tracking cookies.',
          style: TextStyle(fontSize: 13.5, color: Color(0xFF4B5563), height: 1.45),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Close', style: TextStyle(color: Color(0xFF008FF5), fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        DropdownButton<String>(
          value: 'English',
          underline: Container(),
          icon: const Icon(Icons.arrow_drop_down, color: Color(0xFF4B5563)),
          onChanged: (String? newValue) {},
          items: const [
            DropdownMenuItem(
              value: 'English',
              child: Text('English', style: TextStyle(color: Color(0xFF1F2937), fontSize: 14)),
            ),
          ],
        ),
        const SizedBox(height: 20),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Styled Privacy Pill matching Authflow UI
            InkWell(
              borderRadius: BorderRadius.circular(20),
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const PrivacyPolicyPage()),
                );
              },
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
                decoration: BoxDecoration(
                  color: const Color(0xFFF0F4F9),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Text(
                  'Privacy',
                  style: TextStyle(
                    color: Color(0xFF1F2937),
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 16),
            TextButton(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const TermsOfServicePage()),
                );
              },
              child: const Text(
                'Terms',
                style: TextStyle(
                  color: Color(0xFF1F2937),
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
            const SizedBox(width: 8),
            TextButton(
              onPressed: () => _showCookiesDialog(context),
              child: const Text(
                'Cookies',
                style: TextStyle(
                  color: Color(0xFF1F2937),
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        const Text(
          '© 2025 Authflow',
          style: TextStyle(color: Colors.grey, fontSize: 12),
        ),
      ],
    );
  }
}

