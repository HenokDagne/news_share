import 'package:flutter/material.dart';
import 'widgets/top_bar.dart';
import 'widgets/inputbox.dart';
import 'widgets/inputbutton.dart';
import 'widgets/footer.dart';
import 'signup_handler.dart';

class SignUpPage extends StatefulWidget {
  const SignUpPage({super.key});

  @override
  State<SignUpPage> createState() => _SignUpPageState();
}

class _SignUpPageState extends State<SignUpPage> {
  final _formKey = GlobalKey<FormState>();
  final _handler = SignupHandler();

  @override
  void initState() {
    super.initState();
    _handler.usernameController.addListener(_onFieldChanged);
    _handler.emailController.addListener(_onFieldChanged);
    _handler.passwordController.addListener(_onFieldChanged);
    _handler.confirmPasswordController.addListener(_onFieldChanged);
  }

  void _onFieldChanged() {
    if (mounted) {
      setState(() {});
    }
  }

  bool get _isSignUpButtonEnabled {
    final username = _handler.usernameController.text.trim();
    final email = _handler.emailController.text.trim();
    final password = _handler.passwordController.text;
    final confirm = _handler.confirmPasswordController.text;

    // Disabled if any required input is empty
    if (username.isEmpty || email.isEmpty || password.isEmpty || confirm.isEmpty) {
      return false;
    }
    // Disabled if email does not have a basic valid format
    if (!email.contains('@')) {
      return false;
    }
    // Disabled if password and confirmation password do not match
    if (password != confirm) {
      return false;
    }

    return true;
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
                const TopBar(),
                const SizedBox(height: 24),
                InputBox(
                  usernameController: _handler.usernameController,
                  fullNameController: _handler.fullNameController,
                  emailController: _handler.emailController,
                  passwordController: _handler.passwordController,
                  confirmPasswordController: _handler.confirmPasswordController,
                ),
                const SizedBox(height: 24),
                InputButton(
                  formKey: _formKey,
                  isEnabled: _isSignUpButtonEnabled,
                  onSubmit: () => _handler.handleSignUpSubmit(_formKey, context),
                ),
                const SizedBox(height: 16),
                const Footer(),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _handler.usernameController.removeListener(_onFieldChanged);
    _handler.emailController.removeListener(_onFieldChanged);
    _handler.passwordController.removeListener(_onFieldChanged);
    _handler.confirmPasswordController.removeListener(_onFieldChanged);
    _handler.dispose();
    super.dispose();
  }
}
