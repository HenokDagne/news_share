import 'services/api_client.dart';
export 'services/api_client.dart';

class _AuthCompat {
  CurrentUserModel? get currentUser => ApiClient.instance.currentUser;
  Future<void> signOut() => ApiClient.instance.logout();
}

class SupabaseCompat {
  static final SupabaseCompat instance = SupabaseCompat._();
  SupabaseCompat._();

  final client = SupabaseClientCompat();
}

class SupabaseClientCompat {
  final auth = _AuthCompat();
}

final SupabaseCompat Supabase = SupabaseCompat.instance;
final SupabaseClientCompat supabase = SupabaseCompat.instance.client;
