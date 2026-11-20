import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:news_share/screens/auth/google_login_handler.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Google Sign-In & Account Chooser Tests', () {
    setUp(() {
      SharedPreferences.setMockInitialValues({});
    });

    test('GoogleAccountSession serialization and deserialization', () {
      final session = GoogleAccountSession(
        email: 'henokd12@gmail.com',
        displayName: 'Henok Dagne',
        photoUrl: 'https://lh3.googleusercontent.com/a/sample_avatar.jpg',
        idToken: 'sample_id_token_xyz',
        accessToken: 'sample_access_token_123',
      );

      final json = session.toJson();
      expect(json['email'], equals('henokd12@gmail.com'));
      expect(json['displayName'], equals('Henok Dagne'));
      expect(json['photoUrl'], equals('https://lh3.googleusercontent.com/a/sample_avatar.jpg'));
      expect(json['idToken'], equals('sample_id_token_xyz'));

      final restored = GoogleAccountSession.fromJson(json);
      expect(restored.email, equals(session.email));
      expect(restored.displayName, equals(session.displayName));
      expect(restored.photoUrl, equals(session.photoUrl));
      expect(restored.idToken, equals(session.idToken));
    });

    test('GoogleAccountStorage saves, retrieves, and removes genuine accounts', () async {
      final accountsInitial = await GoogleAccountStorage.getAccounts();
      expect(accountsInitial, isEmpty);

      final accountA = GoogleAccountSession(
        email: 'henokd12@gmail.com',
        displayName: 'Henok Dagne',
        photoUrl: 'https://example.com/henok.jpg',
      );

      final accountB = GoogleAccountSession(
        email: 'alex.developer@gmail.com',
        displayName: 'Alex Developer',
        photoUrl: 'https://example.com/alex.jpg',
      );

      await GoogleAccountStorage.saveAccount(accountA);
      await GoogleAccountStorage.saveAccount(accountB);

      final stored = await GoogleAccountStorage.getAccounts();
      expect(stored.length, equals(2));
      expect(stored[0].email, equals('alex.developer@gmail.com'));
      expect(stored[1].email, equals('henokd12@gmail.com'));

      // Deduplication check
      await GoogleAccountStorage.saveAccount(GoogleAccountSession(
        email: 'HENOKD12@GMAIL.COM',
        displayName: 'Henok Dagne Updated',
      ));

      final updated = await GoogleAccountStorage.getAccounts();
      expect(updated.length, equals(2));
      expect(updated[0].email, equals('HENOKD12@GMAIL.COM'));
      expect(updated[0].displayName, equals('Henok Dagne Updated'));

      // Remove check
      await GoogleAccountStorage.removeAccount('alex.developer@gmail.com');
      final afterRemove = await GoogleAccountStorage.getAccounts();
      expect(afterRemove.length, equals(1));
      expect(afterRemove[0].email, equals('HENOKD12@GMAIL.COM'));
    });

    test('GoogleLoginHandler instance configuration', () {
      final handler = GoogleLoginHandler();
      expect(handler, isNotNull);
    });
  });
}
