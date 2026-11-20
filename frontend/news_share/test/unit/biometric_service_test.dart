import 'package:flutter_test/flutter_test.dart';
import 'package:news_share/services/biometric_service.dart';

void main() {
  group('BiometricService Unit Tests', () {
    test('1. BiometricAuthResult models success correctly', () {
      const result = BiometricAuthResult.successResult;
      expect(result.success, isTrue);
      expect(result.canceled, isFalse);
      expect(result.errorMessage, isNull);
    });

    test('2. BiometricAuthResult models user cancellation correctly', () {
      const result = BiometricAuthResult.canceledResult;
      expect(result.success, isFalse);
      expect(result.canceled, isTrue);
    });

    test('3. BiometricAuthResult models custom error messages', () {
      const result = BiometricAuthResult(
        success: false,
        errorMessage: 'Biometric sensor is currently unavailable.',
      );
      expect(result.success, isFalse);
      expect(result.canceled, isFalse);
      expect(result.errorMessage, contains('unavailable'));
    });

    test('4. BiometricStatus enum covers all required hardware states', () {
      expect(BiometricStatus.values, contains(BiometricStatus.available));
      expect(BiometricStatus.values, contains(BiometricStatus.notEnrolled));
      expect(BiometricStatus.values, contains(BiometricStatus.notAvailable));
      expect(BiometricStatus.values, contains(BiometricStatus.unsupported));
    });

    test('5. BiometricService singleton instance exists', () {
      final service1 = BiometricService.instance;
      final service2 = BiometricService.instance;
      expect(identical(service1, service2), isTrue);
    });
  });
}
