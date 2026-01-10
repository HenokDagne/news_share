import 'package:flutter/material.dart';



class SignupHandler {
  // Controllers for all fields
  final usernameController = TextEditingController();
  final emailController = TextEditingController();
  final passwordController = TextEditingController();
  final dobController = TextEditingController();
  final genderController = TextEditingController();

  Future<void> handleSignUpSubmit(GlobalKey<FormState> formKey) async {
    if (formKey.currentState!.validate()) {
      print('\n🔥 === SIGNUP SUBMITTED ===');
      print('👤 Username: ${usernameController.text}');
      print('📧 Email: ${emailController.text}');
      print('🔒 Password: ${passwordController.text}');
      print('📅 DOB: ${dobController.text}');
      print('⚧️ Gender: ${genderController.text}');
      print('✅ All fields valid - Ready for API call!\n');
      
      // Simulate API call
      await Future.delayed(const Duration(seconds: 1));
      print('📡 API call completed');
    } else {
      print('❌ Form validation failed - Fix errors');
    }
  }

  void dispose() {
    usernameController.dispose();
    emailController.dispose();
    passwordController.dispose();
    dobController.dispose();
    genderController.dispose();
  }
}
