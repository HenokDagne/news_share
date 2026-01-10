import 'package:flutter/material.dart';
import 'widgets/login_top_bar.dart';
import 'widgets/login_input.dart';
import 'widgets/login_button.dart';
import 'widgets/login_footer.dart';
import 'login_handler.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  final _handler = LoginHandler();

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
                LoginInput(
                  emailController: _handler.emailController,
                  passwordController: _handler.passwordController,
                ),
                const SizedBox(height: 32),
                LoginButton(
                  formKey: _formKey,
                  onSubmit: () => _handler.handleLoginSubmit(_formKey),
                ),
                const SizedBox(height: 24),
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
