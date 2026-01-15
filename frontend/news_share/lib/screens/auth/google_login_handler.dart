import 'package:flutter/material.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:news_share/screens/home/home_page.dart';

class GoogleLoginHandler {
  final SupabaseClient supabase = Supabase.instance.client;

  // Read Google Web Client ID from .env
  static String get googleWebClientId {
    final id = dotenv.env['client_ID'] ?? dotenv.env['GOOGLE_CLIENT_ID'] ?? '';
    if (id.isEmpty) {
      throw Exception('Google Web Client ID not found in .env');
    }
    return id;
  }

  // ✅ Google Sign-In configured correctly
  late final GoogleSignIn _googleSignIn = GoogleSignIn(
    serverClientId: googleWebClientId,
    scopes: ['email', 'profile'],
  );

  Future<void> handleGoogleLogin(BuildContext context) async {
    try {
      print('🔥 [GoogleLogin] Starting Google OAuth...');

      // 1️⃣ Start Google sign-in
      final googleUser = await _googleSignIn.signIn();
      if (googleUser == null) {
        print('❌ [GoogleLogin] User cancelled sign-in');
        return;
      }

      print('✅ [GoogleLogin] Google user: ${googleUser.email}');

      // 2️⃣ Get auth tokens
      final googleAuth = await googleUser.authentication;

      if (googleAuth.idToken == null) {
        throw Exception('Failed to get Google ID token');
      }

      print('🔑 [GoogleLogin] ID Token received');

      // 3️⃣ Sign in with Supabase
      final AuthResponse response = await supabase.auth.signInWithIdToken(
        provider: OAuthProvider.google,
        idToken: googleAuth.idToken!,
        accessToken: googleAuth.accessToken,
      );

      final user = response.user;

      if (user != null && context.mounted) {
        print('🎉 [GoogleLogin] SUCCESS! User ID: ${user.id}');
        print('📧 [GoogleLogin] Email: ${user.email}');

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Welcome ${user.email ?? "User"}!'),
            backgroundColor: Colors.green,
          ),
        );

        Navigator.push(
          context,
          MaterialPageRoute(builder: (context) => const HomePage()),
        );
      }
    } on AuthException catch (e) {
      print('🔴 [GoogleLogin] AuthException: ${e.message}');
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Google login failed: ${e.message}'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } catch (e, stack) {
      print('💥 [GoogleLogin] Error: $e');
      print('Stack: $stack');
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Google login failed. Try again.'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }
}
