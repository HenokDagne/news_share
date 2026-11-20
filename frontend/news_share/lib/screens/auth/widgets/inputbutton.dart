import 'package:flutter/material.dart';

class InputButton extends StatelessWidget {
  final GlobalKey<FormState> formKey;
  final VoidCallback onSubmit;
  final bool isEnabled;

  const InputButton({
    super.key,
    required this.formKey,
    required this.onSubmit,
    this.isEnabled = true,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 48,
      child: ElevatedButton(
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFF0095F6),
          disabledBackgroundColor: const Color(0xFF0095F6).withOpacity(0.4),
          disabledForegroundColor: Colors.white.withOpacity(0.7),
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
          ),
        ),
        onPressed: isEnabled
            ? () {
                if (formKey.currentState!.validate()) {
                  onSubmit(); // Only call if form is valid
                }
              }
            : null,
        child: const Text(
          'Sign Up',
          style: TextStyle(
            color: Colors.white,
            fontSize: 16,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    );
  }
}
