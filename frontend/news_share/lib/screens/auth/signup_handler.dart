/*
  Handles backend REST API registration, surfaces tailored error messages,
  prompts for email verification before account activation (Section 1.2),
  shows SnackBars, and routes to Home on success.
*/

import 'package:flutter/material.dart';
import 'package:news_share/screens/home/home_page.dart';
import 'package:news_share/services/api_client.dart';

class SignupHandler {
  final emailController = TextEditingController();
  final passwordController = TextEditingController();
  final confirmPasswordController = TextEditingController();
  final usernameController = TextEditingController();
  final fullNameController = TextEditingController();

  Future<void> handleSignUpSubmit(
    GlobalKey<FormState> formKey,
    BuildContext context,
  ) async {
    if (formKey.currentState!.validate()) {
      if (passwordController.text != confirmPasswordController.text) {
        if (context.mounted) {
          _showError(context, 'Passwords do not match');
        }
        return;
      }
      try {
        final email = emailController.text.trim();
        final password = passwordController.text;
        var username = usernameController.text.trim();
        final fullName = fullNameController.text.trim();

        if (username.isEmpty) {
          final prefix = email.split('@').first.replaceAll(RegExp(r'[^a-zA-Z0-9_]'), '_');
          username = prefix.length >= 3 ? prefix.substring(0, prefix.length.clamp(3, 20)) : '${prefix}_user';
        }

        final user = await ApiClient.instance.register(
          email: email,
          password: password,
          username: username,
          fullName: fullName.isNotEmpty ? fullName : null,
        );

        if (context.mounted) {
          if (!ApiClient.instance.isAuthenticated) {
            // Prompt for email verification (Section 1.2)
            showVerificationDialog(context, email);
          } else {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('Welcome ${user.username}!')),
            );
            Navigator.pushReplacement(
              context,
              MaterialPageRoute(builder: (context) => const HomePage()),
            );
          }
        }
      } on ApiException catch (e) {
        if (context.mounted) {
          _showError(context, e.message);
        }
      } catch (e) {
        if (context.mounted) {
          _showError(context, 'Unexpected error: $e');
        }
      }
    }
  }

  void showVerificationDialog(BuildContext context, String email) {
    final tokenController = TextEditingController();
    bool isVerifying = false;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (dialogCtx) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              title: Row(
                children: const [
                  Icon(Icons.mark_email_unread_outlined, color: Colors.blue),
                  SizedBox(width: 8),
                  Text('Verify Your Email'),
                ],
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'A verification token was sent to:\n$email\n\nPlease enter the verification token to activate your account:',
                      style: const TextStyle(fontSize: 14, color: Colors.black87),
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: tokenController,
                      decoration: InputDecoration(
                        labelText: 'Verification Token',
                        hintText: 'Paste token here',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                        prefixIcon: const Icon(Icons.vpn_key_outlined),
                      ),
                    ),
                    const SizedBox(height: 8),
                    TextButton.icon(
                      icon: const Icon(Icons.refresh, size: 16),
                      label: const Text('Resend verification email'),
                      onPressed: () async {
                        try {
                          final msg = await ApiClient.instance.resendVerification(email: email);
                          if (dialogCtx.mounted) {
                            ScaffoldMessenger.of(dialogCtx).showSnackBar(
                              SnackBar(content: Text(msg)),
                            );
                          }
                        } catch (e) {
                          if (dialogCtx.mounted) {
                            ScaffoldMessenger.of(dialogCtx).showSnackBar(
                              SnackBar(content: Text('Failed to resend: $e'), backgroundColor: Colors.red),
                            );
                          }
                        }
                      },
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: isVerifying ? null : () => Navigator.pop(dialogCtx),
                  child: const Text('Cancel'),
                ),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.blue,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  onPressed: isVerifying
                       ? null
                      : () async {
                          final token = tokenController.text.trim();
                          if (token.isEmpty) {
                            ScaffoldMessenger.of(dialogCtx).showSnackBar(
                              const SnackBar(content: Text('Please enter the verification token')),
                            );
                            return;
                          }

                          setDialogState(() => isVerifying = true);
                          try {
                            final user = await ApiClient.instance.verifyEmail(token: token);
                            if (dialogCtx.mounted) {
                              Navigator.pop(dialogCtx);
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text('Account verified! Welcome ${user.username}')),
                              );
                              Navigator.pushReplacement(
                                context,
                                MaterialPageRoute(builder: (context) => const HomePage()),
                              );
                            }
                          } catch (e) {
                            setDialogState(() => isVerifying = false);
                            if (dialogCtx.mounted) {
                              ScaffoldMessenger.of(dialogCtx).showSnackBar(
                                SnackBar(
                                  content: Text(e is ApiException ? e.message : 'Verification failed: $e'),
                                  backgroundColor: Colors.red,
                                ),
                              );
                            }
                          }
                        },
                  child: isVerifying
                      ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Text('Verify & Activate'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _showError(BuildContext context, String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: Colors.red),
    );
  }

  void dispose() {
    emailController.dispose();
    passwordController.dispose();
    confirmPasswordController.dispose();
    usernameController.dispose();
    fullNameController.dispose();
  }
}
