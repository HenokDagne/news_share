/*
  Handles backend REST API email/password login, native Android fingerprint biometric authentication,
  email verification prompts on 403, account recovery (forgot/reset password),
  and graceful fallbacks.
*/

import 'package:flutter/material.dart';
import 'package:news_share/screens/home/home_page.dart';
import 'package:news_share/services/api_client.dart';
import 'package:news_share/services/biometric_service.dart';

class LoginHandler {
  final emailController = TextEditingController();
  final passwordController = TextEditingController();

  Future<void> handleLoginSubmit(
    GlobalKey<FormState> formKey,
    BuildContext context,
  ) async {
    final email = emailController.text.trim();
    final password = passwordController.text;

    if (formKey.currentState!.validate()) {
      try {
        await ApiClient.instance.login(
          email: email,
          password: password,
        );

        // Store email for biometric fast login
        await BiometricService.instance.setBiometricEnabled(true, email: email);

        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Login successful!')),
          );
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(builder: (context) => const HomePage()),
          );
        }
      } on ApiException catch (e) {
        if (context.mounted) {
          if (e.statusCode == 403 && e.message.toLowerCase().contains('not verified')) {
            _showUnverifiedEmailDialog(context, email);
          } else {
            _showError(context, e.message);
          }
        }
      } catch (e) {
        if (context.mounted) {
          _showError(context, 'Login failed: $e');
        }
      }
    }
  }

  /// Native Android Fingerprint Biometric Login
  Future<void> handleBiometricLogin(BuildContext context) async {
    final status = await BiometricService.instance.getStatus();
    if (status == BiometricStatus.unsupported) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Biometric authentication is not supported on this device. Use password instead.')),
        );
      }
      return;
    }

    if (status == BiometricStatus.notEnrolled) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No fingerprints enrolled. Please register your fingerprint in Android Settings.')),
        );
      }
      return;
    }

    // Authenticate using native Android biometric prompt
    final result = await BiometricService.instance.authenticate(
      localizedReason: 'Scan your fingerprint to authenticate with News Share',
      allowDeviceCredentialFallback: true,
    );

    if (!context.mounted) return;

    if (result.success) {
      // Fingerprint verified!
      // Check if user has an active session or saved email
      if (ApiClient.instance.isAuthenticated) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Fingerprint recognized! Welcome back.')),
        );
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (context) => const HomePage()),
        );
        return;
      }

      final savedEmail = await BiometricService.instance.getSavedBiometricEmail();
      if (savedEmail != null && savedEmail.isNotEmpty) {
        emailController.text = savedEmail;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Fingerprint verified! Please enter your password or sign in with Google to continue.')),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Fingerprint verified! Sign in with your credentials once to link your account.')),
        );
      }
    } else if (!result.canceled) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result.errorMessage ?? 'Biometric authentication failed. Falling back to password.'),
          backgroundColor: Colors.orange.shade800,
        ),
      );
    }
  }

  /// Account Recovery: Forgot & Reset Password Dialog
  void showForgotPasswordDialog(BuildContext context) {
    final resetEmailController = TextEditingController(text: emailController.text.trim());
    final resetTokenController = TextEditingController();
    final newPasswordController = TextEditingController();

    bool codeSent = false;
    bool isSubmitting = false;

    showDialog(
      context: context,
      builder: (dialogCtx) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              title: Row(
                children: const [
                  Icon(Icons.lock_reset, color: Colors.blue),
                  SizedBox(width: 8),
                  Text('Reset Password'),
                ],
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (!codeSent) ...[
                      const Text(
                        'Enter your registered email address to receive a secure password reset token:',
                        style: TextStyle(fontSize: 14),
                      ),
                      const SizedBox(height: 16),
                      TextField(
                        controller: resetEmailController,
                        keyboardType: TextInputType.emailAddress,
                        decoration: InputDecoration(
                          labelText: 'Email Address',
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                          prefixIcon: const Icon(Icons.email_outlined),
                        ),
                      ),
                    ] else ...[
                      Text(
                        'A reset token was sent to:\n${resetEmailController.text.trim()}\n\nEnter the token and your new password:',
                        style: const TextStyle(fontSize: 14),
                      ),
                      const SizedBox(height: 16),
                      TextField(
                        controller: resetTokenController,
                        decoration: InputDecoration(
                          labelText: 'Reset Token',
                          hintText: 'Paste token here',
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                          prefixIcon: const Icon(Icons.vpn_key_outlined),
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: newPasswordController,
                        obscureText: true,
                        decoration: InputDecoration(
                          labelText: 'New Password',
                          hintText: 'At least 8 characters',
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                          prefixIcon: const Icon(Icons.lock_outline),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: isSubmitting ? null : () => Navigator.pop(dialogCtx),
                  child: const Text('Cancel'),
                ),
                if (!codeSent)
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.blue,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    onPressed: isSubmitting
                        ? null
                        : () async {
                            final email = resetEmailController.text.trim();
                            if (email.isEmpty || !email.contains('@')) {
                              ScaffoldMessenger.of(dialogCtx).showSnackBar(
                                const SnackBar(content: Text('Please enter a valid email address')),
                              );
                              return;
                            }

                            setDialogState(() => isSubmitting = true);
                            try {
                              final msg = await ApiClient.instance.forgotPassword(email: email);
                              setDialogState(() {
                                isSubmitting = false;
                                codeSent = true;
                              });
                              if (dialogCtx.mounted) {
                                ScaffoldMessenger.of(dialogCtx).showSnackBar(
                                  SnackBar(content: Text(msg)),
                                );
                              }
                            } catch (e) {
                              setDialogState(() => isSubmitting = false);
                              if (dialogCtx.mounted) {
                                ScaffoldMessenger.of(dialogCtx).showSnackBar(
                                  SnackBar(content: Text('Failed: $e'), backgroundColor: Colors.red),
                                );
                              }
                            }
                          },
                    child: isSubmitting
                        ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Text('Send Reset Token'),
                  )
                else
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.blue,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    onPressed: isSubmitting
                        ? null
                        : () async {
                            final token = resetTokenController.text.trim();
                            final newPassword = newPasswordController.text;

                            if (token.isEmpty) {
                              ScaffoldMessenger.of(dialogCtx).showSnackBar(
                                const SnackBar(content: Text('Please enter the reset token')),
                              );
                              return;
                            }
                            if (newPassword.length < 8) {
                              ScaffoldMessenger.of(dialogCtx).showSnackBar(
                                const SnackBar(content: Text('Password must be at least 8 characters')),
                              );
                              return;
                            }

                            setDialogState(() => isSubmitting = true);
                            try {
                              final msg = await ApiClient.instance.resetPassword(
                                token: token,
                                newPassword: newPassword,
                              );
                              if (dialogCtx.mounted) {
                                Navigator.pop(dialogCtx);
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(content: Text(msg)),
                                );
                              }
                            } catch (e) {
                              setDialogState(() => isSubmitting = false);
                              if (dialogCtx.mounted) {
                                ScaffoldMessenger.of(dialogCtx).showSnackBar(
                                  SnackBar(content: Text('Reset failed: $e'), backgroundColor: Colors.red),
                                );
                              }
                            }
                          },
                    child: isSubmitting
                        ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Text('Confirm Reset'),
                  ),
              ],
            );
          },
        );
      },
    );
  }

  void _showUnverifiedEmailDialog(BuildContext context, String email) {
    final tokenController = TextEditingController();
    bool isVerifying = false;

    showDialog(
      context: context,
      builder: (dialogCtx) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              title: Row(
                children: const [
                  Icon(Icons.warning_amber_rounded, color: Colors.orange),
                  SizedBox(width: 8),
                  Text('Email Not Verified'),
                ],
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Your email ($email) is not yet activated.\nPlease enter your verification token below:',
                      style: const TextStyle(fontSize: 14),
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: tokenController,
                      decoration: InputDecoration(
                        labelText: 'Verification Token',
                        hintText: 'Paste token here',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                    ),
                    const SizedBox(height: 8),
                    TextButton(
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
                              SnackBar(content: Text('Failed: $e'), backgroundColor: Colors.red),
                            );
                          }
                        }
                      },
                      child: const Text('Resend verification token'),
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
                              const SnackBar(content: Text('Please enter token')),
                            );
                            return;
                          }

                          setDialogState(() => isVerifying = true);
                          try {
                            final user = await ApiClient.instance.verifyEmail(token: token);
                            if (dialogCtx.mounted) {
                              Navigator.pop(dialogCtx);
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text('Verified! Welcome ${user.username}')),
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
                                SnackBar(content: Text('Verification failed: $e'), backgroundColor: Colors.red),
                              );
                            }
                          }
                        },
                  child: isVerifying
                      ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Text('Verify'),
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
  }
}
