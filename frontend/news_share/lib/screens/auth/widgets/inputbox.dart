import 'package:flutter/material.dart';

class InputBox extends StatelessWidget {
  final TextEditingController emailController;
  final TextEditingController passwordController;
  final TextEditingController? usernameController;
  final TextEditingController? fullNameController;

  const InputBox({
    super.key,
    required this.emailController,
    required this.passwordController,
    this.usernameController,
    this.fullNameController,
  });

  InputDecoration _fieldDecoration(String hint) => InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(color: Color(0xFFB3B3B3), fontSize: 14),
        filled: true,
        fillColor: const Color(0xFFF8F8F8),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: Color(0xFFE4E4E4)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: Color(0xFF0095F6), width: 1.3),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      );

  TextStyle get _labelStyle => const TextStyle(
        fontSize: 12,
        color: Color(0xFF8E8E8E),
        fontWeight: FontWeight.w500,
      );

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (usernameController != null) ...[
          Text('Username', style: _labelStyle),
          const SizedBox(height: 6),
          TextFormField(
            controller: usernameController,
            decoration: _fieldDecoration('Username (3-20 letters/numbers)'),
            validator: (v) {
              if (v == null || v.trim().isEmpty) return 'Username required';
              if (v.trim().length < 3 || v.trim().length > 20) {
                return '3-20 characters required';
              }
              if (!RegExp(r'^[a-zA-Z0-9_]+$').hasMatch(v.trim())) {
                return 'Letters, numbers, underscores only';
              }
              return null;
            },
          ),
          const SizedBox(height: 18),
        ],
        if (fullNameController != null) ...[
          Text('Full Name (Optional)', style: _labelStyle),
          const SizedBox(height: 6),
          TextFormField(
            controller: fullNameController,
            decoration: _fieldDecoration('Full Name'),
          ),
          const SizedBox(height: 18),
        ],
        Text('Email', style: _labelStyle),
        const SizedBox(height: 6),
        TextFormField(
          controller: emailController,
          keyboardType: TextInputType.emailAddress,
          decoration: _fieldDecoration('Email'),
          validator: (v) => v?.contains('@') != true ? 'Valid email required' : null,
        ),
        const SizedBox(height: 18),
        Text('New Password', style: _labelStyle),
        const SizedBox(height: 6),
        TextFormField(
          controller: passwordController,
          obscureText: true,
          decoration: _fieldDecoration('Create a strong password (min 8 chars)'),
          validator: (v) => v != null && v.length < 8 ? 'Min 8 characters required' : null,
        ),
        const SizedBox(height: 26),
      ],
    );
  }
}
