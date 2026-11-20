// Handles sign-out for local backend REST API, shows a success/failure SnackBar, and guards UI ops with context.mounted.
import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:google_sign_in/google_sign_in.dart';
import '../../services/api_client.dart';
import 'login.dart';

class LogoutHandler {
  final GoogleSignIn _googleSignIn = GoogleSignIn(
    serverClientId: dotenv.env['GOOGLE_CLIENT_ID'] ?? dotenv.env['client_ID'],
  );

  Future<void> handleLogout(BuildContext context) async {
    try {
      final userEmail = ApiClient.instance.currentUserEmail;

      await ApiClient.instance.logout();
      try {
        await _googleSignIn.signOut();
      } catch (_) {}

      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Logged out successfully, ${userEmail ?? "User"}!'),
            backgroundColor: Colors.green,
            duration: const Duration(seconds: 2),
          ),
        );

        Navigator.pushAndRemoveUntil(
          context,
          MaterialPageRoute(builder: (_) => const LoginPage()),
          (route) => false,
        );
      }
    } catch (e) {
      if (context.mounted) {
        _showError(context, 'Logout failed: $e');
      }
    }
  }

  void _showError(BuildContext context, String message) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message), backgroundColor: Colors.red),
      );
    }
  }
}
