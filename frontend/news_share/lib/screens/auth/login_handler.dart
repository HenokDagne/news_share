import 'package:flutter/material.dart';

class LoginHandler {
  final emailController = TextEditingController();
  final passwordController = TextEditingController();

  Future<void> handleLoginSubmit(GlobalKey<FormState> formKey) async {
    if (formKey.currentState!.validate()) {
      print('\n🔥 === LOGIN SUBMITTED ===');
      print('📧 Email: ${emailController.text}');
      print('🔒 Password: ${passwordController.text}');
      print('✅ Login data valid - Ready for API!\n');
      
      // Simulate API
      await Future.delayed(const Duration(seconds: 1));
      print('📡 Login API completed');
    } else {
      print('❌ Login validation failed');
    }
  }

  void dispose() {
    emailController.dispose();
    passwordController.dispose();
  }
}
