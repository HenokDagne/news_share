import 'package:flutter/material.dart';

enum PasswordStrength { none, weak, medium, strong }

class InputBox extends StatefulWidget {
  final TextEditingController emailController;
  final TextEditingController passwordController;
  final TextEditingController? confirmPasswordController;
  final TextEditingController? usernameController;
  final TextEditingController? fullNameController;

  const InputBox({
    super.key,
    required this.emailController,
    required this.passwordController,
    this.confirmPasswordController,
    this.usernameController,
    this.fullNameController,
  });

  @override
  State<InputBox> createState() => _InputBoxState();
}

class _InputBoxState extends State<InputBox> {
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;
  late final TextEditingController _confirmController;
  bool _internalConfirm = false;

  @override
  void initState() {
    super.initState();
    if (widget.confirmPasswordController != null) {
      _confirmController = widget.confirmPasswordController!;
    } else {
      _confirmController = TextEditingController();
      _internalConfirm = true;
    }
    widget.passwordController.addListener(_onFieldsChanged);
    _confirmController.addListener(_onFieldsChanged);
  }

  void _onFieldsChanged() {
    if (mounted) {
      setState(() {});
    }
  }

  @override
  void dispose() {
    widget.passwordController.removeListener(_onFieldsChanged);
    _confirmController.removeListener(_onFieldsChanged);
    if (_internalConfirm) {
      _confirmController.dispose();
    }
    super.dispose();
  }

  PasswordStrength _evaluateStrength(String password) {
    if (password.isEmpty) return PasswordStrength.none;
    if (password.length < 6) return PasswordStrength.weak;

    int score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (RegExp(r'[a-z]').hasMatch(password)) score++;
    if (RegExp(r'[A-Z]').hasMatch(password)) score++;
    if (RegExp(r'[0-9]').hasMatch(password)) score++;
    if (RegExp(r'[^a-zA-Z0-9]').hasMatch(password)) score++;

    // Strong: at least 8 chars and strong variety (score >= 5)
    if (password.length >= 8 && score >= 5) {
      return PasswordStrength.strong;
    }
    // Medium: at least 6 chars and moderate variety (score >= 3)
    if (password.length >= 6 && score >= 3) {
      return PasswordStrength.medium;
    }
    return PasswordStrength.weak;
  }

  Color _getStrengthColor(PasswordStrength strength) {
    switch (strength) {
      case PasswordStrength.weak:
        return const Color(0xFFE53935); // Red
      case PasswordStrength.medium:
        return const Color(0xFFFB8C00); // Orange
      case PasswordStrength.strong:
        return const Color(0xFF43A047); // Green
      case PasswordStrength.none:
        return const Color(0xFFE0E0E0); // Inactive Grey
    }
  }

  String _getStrengthLabel(PasswordStrength strength) {
    switch (strength) {
      case PasswordStrength.weak:
        return 'Weak';
      case PasswordStrength.medium:
        return 'Medium';
      case PasswordStrength.strong:
        return 'Strong';
      case PasswordStrength.none:
        return '';
    }
  }

  String _getStrengthTip(PasswordStrength strength) {
    switch (strength) {
      case PasswordStrength.weak:
        return 'Weak password (allowed, but 8+ chars & numbers recommended)';
      case PasswordStrength.medium:
        return 'Good, add symbols or uppercase for a stronger password';
      case PasswordStrength.strong:
        return 'Strong password!';
      case PasswordStrength.none:
        return '';
    }
  }

  int _getActiveDashCount(PasswordStrength strength) {
    switch (strength) {
      case PasswordStrength.weak:
        return 1;
      case PasswordStrength.medium:
        return 2;
      case PasswordStrength.strong:
        return 3;
      case PasswordStrength.none:
        return 0;
    }
  }

  InputDecoration _fieldDecoration(
    String hint, {
    Widget? suffixIcon,
    Color? borderColor,
    double borderWidth = 1.0,
  }) =>
      InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(color: Color(0xFFB3B3B3), fontSize: 14),
        filled: true,
        fillColor: const Color(0xFFF8F8F8),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(
            color: borderColor ?? const Color(0xFFE4E4E4),
            width: borderWidth,
          ),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(
            color: borderColor ?? const Color(0xFF0095F6),
            width: borderColor != null ? borderWidth : 1.3,
          ),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: Color(0xFFE53935)),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: Color(0xFFE53935), width: 1.3),
        ),
        suffixIcon: suffixIcon,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      );

  TextStyle get _labelStyle => const TextStyle(
        fontSize: 12,
        color: Color(0xFF8E8E8E),
        fontWeight: FontWeight.w500,
      );

  Widget _buildDash(int index, int activeCount, Color activeColor) {
    final isActive = index < activeCount;
    return Expanded(
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeInOut,
        height: 4,
        decoration: BoxDecoration(
          color: isActive ? activeColor : const Color(0xFFE0E0E0),
          borderRadius: BorderRadius.circular(2),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final passwordText = widget.passwordController.text;
    final confirmText = _confirmController.text;
    final strength = _evaluateStrength(passwordText);
    final strengthColor = _getStrengthColor(strength);
    final strengthLabel = _getStrengthLabel(strength);
    final strengthTip = _getStrengthTip(strength);
    final activeDashes = _getActiveDashCount(strength);

    // Live match evaluation
    final bool hasConfirmText = confirmText.isNotEmpty;
    final bool hasPasswordText = passwordText.isNotEmpty;
    final bool isMatching = hasConfirmText && hasPasswordText && (passwordText == confirmText);
    final bool isMismatching = hasConfirmText && (passwordText != confirmText);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (widget.usernameController != null) ...[
          Text('Username', style: _labelStyle),
          const SizedBox(height: 6),
          TextFormField(
            controller: widget.usernameController,
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
        if (widget.fullNameController != null) ...[
          Text('Full Name (Optional)', style: _labelStyle),
          const SizedBox(height: 6),
          TextFormField(
            controller: widget.fullNameController,
            decoration: _fieldDecoration('Full Name'),
          ),
          const SizedBox(height: 18),
        ],
        Text('Email', style: _labelStyle),
        const SizedBox(height: 6),
        TextFormField(
          controller: widget.emailController,
          keyboardType: TextInputType.emailAddress,
          decoration: _fieldDecoration('Email'),
          validator: (v) => v?.contains('@') != true ? 'Valid email required' : null,
        ),
        const SizedBox(height: 18),
        Text('New Password', style: _labelStyle),
        const SizedBox(height: 6),
        TextFormField(
          controller: widget.passwordController,
          obscureText: _obscurePassword,
          decoration: _fieldDecoration(
            'Create a password (min 4 chars)',
            suffixIcon: IconButton(
              icon: Icon(
                _obscurePassword ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                color: const Color(0xFF8E8E8E),
                size: 20,
              ),
              onPressed: () {
                setState(() {
                  _obscurePassword = !_obscurePassword;
                });
              },
            ),
          ),
          // Informational only: Weak passwords are permitted for registration
          validator: (v) {
            if (v == null || v.isEmpty) return 'Password required';
            if (v.length < 4) return 'Min 4 characters required';
            return null;
          },
        ),
        const SizedBox(height: 8),

        // Real-time Segmented Dash Strength Indicator directly below password
        Row(
          children: [
            _buildDash(0, activeDashes, strengthColor),
            const SizedBox(width: 6),
            _buildDash(1, activeDashes, strengthColor),
            const SizedBox(width: 6),
            _buildDash(2, activeDashes, strengthColor),
          ],
        ),
        if (strengthLabel.isNotEmpty) ...[
          const SizedBox(height: 6),
          Row(
            children: [
              Text(
                strengthLabel,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: strengthColor,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  strengthTip,
                  style: const TextStyle(
                    fontSize: 11,
                    color: Color(0xFF757575),
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ],

        const SizedBox(height: 18),
        Text('Confirm Password', style: _labelStyle),
        const SizedBox(height: 6),
        TextFormField(
          controller: _confirmController,
          obscureText: _obscureConfirmPassword,
          decoration: _fieldDecoration(
            'Re-enter your password',
            borderColor: isMatching
                ? const Color(0xFF43A047)
                : (isMismatching ? const Color(0xFFE53935) : null),
            borderWidth: (isMatching || isMismatching) ? 1.5 : 1.0,
            suffixIcon: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (isMatching)
                  const Padding(
                    padding: EdgeInsets.only(right: 2),
                    child: Icon(
                      Icons.check_circle_rounded,
                      color: Color(0xFF43A047),
                      size: 20,
                    ),
                  )
                else if (isMismatching)
                  const Padding(
                    padding: EdgeInsets.only(right: 2),
                    child: Icon(
                      Icons.cancel_rounded,
                      color: Color(0xFFE53935),
                      size: 20,
                    ),
                  ),
                IconButton(
                  icon: Icon(
                    _obscureConfirmPassword ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                    color: const Color(0xFF8E8E8E),
                    size: 20,
                  ),
                  onPressed: () {
                    setState(() {
                      _obscureConfirmPassword = !_obscureConfirmPassword;
                    });
                  },
                ),
              ],
            ),
          ),
          validator: (v) {
            if (v == null || v.isEmpty) return 'Please confirm your password';
            if (v != widget.passwordController.text) return 'Passwords do not match';
            return null;
          },
        ),

        // Live feature: match / mismatch status row
        if (hasConfirmText) ...[
          const SizedBox(height: 6),
          Row(
            children: [
              Icon(
                isMatching ? Icons.check_circle_outline_rounded : Icons.highlight_off_rounded,
                size: 16,
                color: isMatching ? const Color(0xFF43A047) : const Color(0xFFE53935),
              ),
              const SizedBox(width: 6),
              Text(
                isMatching ? 'Passwords match' : 'Passwords do not match',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: isMatching ? const Color(0xFF43A047) : const Color(0xFFE53935),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
        ] else ...[
          const SizedBox(height: 26),
        ],
      ],
    );
  }
}
