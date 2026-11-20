// lib/screens/auth/login.dart
/*
  Renders the login UI with email/password, native Android fingerprint biometric authentication,
  account recovery, and Google auth. Wires submit handlers, and shows a logout button when already signed in.
*/
import 'package:flutter/material.dart';
import '../../services/api_client.dart';
import '../../services/biometric_service.dart';
import 'widgets/login_top_bar.dart';
import 'widgets/login_input.dart';
import 'widgets/login_button.dart';
import 'widgets/login_footer.dart';
import 'login_handler.dart';
import 'google_login_handler.dart';
import 'logout.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  final _handler = LoginHandler();
  final _googleHandler = GoogleLoginHandler();
  final _logoutHandler = LogoutHandler();
  bool isGoogleLoading = false;
  bool isBiometricSupported = false;

  bool get isLoggedIn => ApiClient.instance.isAuthenticated;

  @override
  void initState() {
    super.initState();
    _checkBiometrics();
  }

  Future<void> _checkBiometrics() async {
    final supported = await BiometricService.instance.canCheckBiometrics();
    if (mounted) {
      setState(() {
        isBiometricSupported = supported;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const LoginTopBar(),
                const SizedBox(height: 24),

                // Email & Password Inputs
                LoginInput(
                  emailController: _handler.emailController,
                  passwordController: _handler.passwordController,
                ),

                // Forgot Password Link (Section 1.2 Account Recovery)
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton(
                    onPressed: () => _handler.showForgotPasswordDialog(context),
                    child: const Text(
                      'Forgot Password?',
                      style: TextStyle(
                        fontSize: 13,
                        color: Colors.blue,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 12),

                // Email/Password Login Button
                LoginButton(
                  formKey: _formKey,
                  onSubmit: () => _handler.handleLoginSubmit(_formKey, context),
                ),
                const SizedBox(height: 14),

                // Native Android Biometric / Fingerprint Authentication Button
                if (isBiometricSupported) ...[
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.blue.shade700,
                        side: BorderSide(color: Colors.blue.shade300, width: 1.5),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                      ),
                      icon: const Icon(
                        Icons.fingerprint,
                        size: 26,
                        color: Colors.blue,
                      ),
                      label: const Text(
                        'Sign in with Fingerprint',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      onPressed: () => _handler.handleBiometricLogin(context),
                    ),
                  ),
                  const SizedBox(height: 14),
                ],

                // Google Login Button
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: Colors.black87,
                      elevation: 1,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                        side: BorderSide(color: Colors.grey.shade300),
                      ),
                    ),
                    icon: Image.asset(
                      'assets/images/google_logo.png',
                      height: 20,
                      width: 20,
                    ),
                    label: isGoogleLoading
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text(
                            'Continue with Google',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                    onPressed: isGoogleLoading
                        ? null
                        : () async {
                            setState(() => isGoogleLoading = true);
                            try {
                              await _googleHandler.handleGoogleLogin(context);
                            } finally {
                              if (mounted) {
                                setState(() => isGoogleLoading = false);
                              }
                            }
                          },
                  ),
                ),
                const SizedBox(height: 24),

                // ---------------- LOGOUT BUTTON (ONLY IF LOGGED IN) ----------------
                if (isLoggedIn) ...[
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton.icon(
                      icon: const Icon(Icons.logout),
                      label: const Text('Logout'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.red,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                      ),
                      onPressed: () => _logoutHandler.handleLogout(context),
                    ),
                  ),
                  const SizedBox(height: 24),
                ],

                // Footer
                const LoginFooter(),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _handler.dispose();
    super.dispose();
  }
}
