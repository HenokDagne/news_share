import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:local_auth/local_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';

enum BiometricStatus {
  available,
  notEnrolled,
  notAvailable,
  unsupported,
}

class BiometricAuthResult {
  final bool success;
  final String? errorMessage;
  final bool canceled;

  const BiometricAuthResult({
    required this.success,
    this.errorMessage,
    this.canceled = false,
  });

  static const successResult = BiometricAuthResult(success: true);
  static const canceledResult = BiometricAuthResult(success: false, canceled: true);
}

class BiometricService {
  static final BiometricService instance = BiometricService._internal();
  BiometricService._internal();

  final LocalAuthentication _auth = LocalAuthentication();

  static const String _prefBiometricEnabled = 'news_share_biometric_enabled';
  static const String _prefBiometricEmail = 'news_share_biometric_email';

  /// Check whether the device hardware supports biometrics
  Future<bool> isDeviceSupported() async {
    try {
      return await _auth.isDeviceSupported();
    } catch (e) {
      debugPrint('BiometricService.isDeviceSupported error: $e');
      return false;
    }
  }

  /// Check whether biometric sensors can be checked (hardware exists and is active)
  Future<bool> canCheckBiometrics() async {
    try {
      final canCheck = await _auth.canCheckBiometrics;
      final isSupported = await _auth.isDeviceSupported();
      return canCheck || isSupported;
    } catch (e) {
      debugPrint('BiometricService.canCheckBiometrics error: $e');
      return false;
    }
  }

  /// Get the list of enrolled biometrics on the device
  Future<List<BiometricType>> getAvailableBiometrics() async {
    try {
      return await _auth.getAvailableBiometrics();
    } catch (e) {
      debugPrint('BiometricService.getAvailableBiometrics error: $e');
      return [];
    }
  }

  /// Check specifically for fingerprint support / enrollment
  Future<bool> hasFingerprintSupport() async {
    try {
      final available = await getAvailableBiometrics();
      return available.contains(BiometricType.fingerprint) ||
          available.contains(BiometricType.strong);
    } catch (e) {
      debugPrint('BiometricService.hasFingerprintSupport error: $e');
      return false;
    }
  }

  /// Get detailed status of biometrics on this device
  Future<BiometricStatus> getStatus() async {
    try {
      final supported = await _auth.isDeviceSupported();
      if (!supported) return BiometricStatus.unsupported;

      final canCheck = await _auth.canCheckBiometrics;
      final available = await _auth.getAvailableBiometrics();

      if (available.isEmpty && !canCheck) {
        return BiometricStatus.notEnrolled;
      }

      if (available.isEmpty) {
        return BiometricStatus.notEnrolled;
      }

      return BiometricStatus.available;
    } catch (e) {
      debugPrint('BiometricService.getStatus error: $e');
      return BiometricStatus.notAvailable;
    }
  }

  /// Authenticate using Android fingerprint sensor or device credentials as secure fallback
  Future<BiometricAuthResult> authenticate({
    String localizedReason = 'Scan your fingerprint to authenticate with News Share',
    bool allowDeviceCredentialFallback = true,
  }) async {
    try {
      final isSupported = await _auth.isDeviceSupported();
      final canCheck = await _auth.canCheckBiometrics;

      if (!isSupported && !canCheck) {
        return const BiometricAuthResult(
          success: false,
          errorMessage: 'Biometric authentication is not supported on this device.',
        );
      }

      final available = await _auth.getAvailableBiometrics();
      if (available.isEmpty) {
        return const BiometricAuthResult(
          success: false,
          errorMessage: 'No fingerprints or biometrics enrolled. Please set up a fingerprint in Android Settings.',
        );
      }

      final authenticated = await _auth.authenticate(
        localizedReason: localizedReason,
        options: AuthenticationOptions(
          biometricOnly: !allowDeviceCredentialFallback,
          stickyAuth: true,
          useErrorDialogs: true,
          sensitiveTransaction: true,
        ),
      );

      if (authenticated) {
        return BiometricAuthResult.successResult;
      } else {
        return BiometricAuthResult.canceledResult;
      }
    } on PlatformException catch (e) {
      debugPrint('BiometricService.authenticate PlatformException: ${e.code} - ${e.message}');
      switch (e.code) {
        case 'NotAvailable':
          return const BiometricAuthResult(
            success: false,
            errorMessage: 'Biometric sensor is currently unavailable.',
          );
        case 'NotEnrolled':
          return const BiometricAuthResult(
            success: false,
            errorMessage: 'No fingerprints enrolled. Please register a fingerprint in your device Settings.',
          );
        case 'LockedOut':
          return const BiometricAuthResult(
            success: false,
            errorMessage: 'Too many failed attempts. Biometric sensor is temporarily locked.',
          );
        case 'PermanentlyLockedOut':
          return const BiometricAuthResult(
            success: false,
            errorMessage: 'Biometrics are locked. Please unlock using your phone PIN/password.',
          );
        case 'PasscodeNotSet':
          return const BiometricAuthResult(
            success: false,
            errorMessage: 'Device passcode or pattern is not set up on this device.',
          );
        case 'OtherOperatingSystem':
          return const BiometricAuthResult(
            success: false,
            errorMessage: 'Biometrics are only available on supported mobile operating systems.',
          );
        default:
          return BiometricAuthResult(
            success: false,
            errorMessage: e.message ?? 'Biometric authentication failed.',
          );
      }
    } catch (e) {
      debugPrint('BiometricService.authenticate error: $e');
      return BiometricAuthResult(
        success: false,
        errorMessage: 'An unexpected biometric error occurred: $e',
      );
    }
  }

  /// Cancel any pending authentication
  Future<void> cancelAuthentication() async {
    try {
      await _auth.stopAuthentication();
    } catch (e) {
      debugPrint('BiometricService.cancelAuthentication error: $e');
    }
  }

  // ===================== BIOMETRIC SETTINGS & SAVED SESSION =====================

  /// Check whether the user has enabled biometric unlock
  Future<bool> isBiometricEnabled() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_prefBiometricEnabled) ?? false;
  }

  /// Enable or disable biometric quick unlock
  Future<void> setBiometricEnabled(bool enabled, {String? email}) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_prefBiometricEnabled, enabled);
    if (email != null) {
      await prefs.setString(_prefBiometricEmail, email);
    } else if (!enabled) {
      await prefs.remove(_prefBiometricEmail);
    }
  }

  /// Get the saved email associated with biometric login
  Future<String?> getSavedBiometricEmail() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_prefBiometricEmail);
  }
}
