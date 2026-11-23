import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import '../privacy_policy_page.dart';
import '../terms_of_service_page.dart';

class Footer extends StatelessWidget {
  const Footer({super.key});

  @override
  Widget build(BuildContext context) {
    final style = Theme.of(context).textTheme.bodySmall;

    return Text.rich(
      TextSpan(
        children: [
          const TextSpan(
            text: 'By clicking Sign Up, you agree to our ',
          ),
          TextSpan(
            text: 'Terms',
            style: style?.copyWith(
              color: const Color(0xFF008FF5),
              decoration: TextDecoration.underline,
            ),
            recognizer: TapGestureRecognizer()
              ..onTap = () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const TermsOfServicePage()),
                );
              },
          ),
          const TextSpan(text: ', '),
          TextSpan(
            text: 'Privacy Policy',
            style: style?.copyWith(
              color: const Color(0xFF008FF5),
              decoration: TextDecoration.underline,
            ),
            recognizer: TapGestureRecognizer()
              ..onTap = () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const PrivacyPolicyPage()),
                );
              },
          ),
          const TextSpan(text: ' and '),
          TextSpan(
            text: 'Cookies Policy',
            style: style?.copyWith(
              color: const Color(0xFF008FF5),
              decoration: TextDecoration.underline,
            ),
            recognizer: TapGestureRecognizer()
              ..onTap = () {
                showDialog(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    backgroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    title: const Text('Cookies Policy', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                    content: const Text(
                      'Authflow uses secure session storage strictly for maintaining your authenticated session and security verification.',
                    ),
                    actions: [
                      TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('OK')),
                    ],
                  ),
                );
              },
          ),
          const TextSpan(
            text:
                '. You may receive SMS notifications from us and can opt out any time.',
          ),
        ],
      ),
      textAlign: TextAlign.center,
      style: style,
    );
  }
}
