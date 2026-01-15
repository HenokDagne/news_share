import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'user_model.dart';

class UserFetcher {
  final SupabaseClient supabase = Supabase.instance.client;

  /// Fetch all users from the 'profiles' table
  Future<List<UserItem>> fetchUsers() async {
    try {
      final data = await supabase
          .from('profiles')
          .select()
          .order('full_name'); // optional

      if (data == null) return [];

      return (data as List)
          .whereType<Map<String, dynamic>>()
          .map((e) => UserItem.fromJson(e))
          .toList();
    } catch (e) {
      debugPrint('Error fetching users: $e');
      return [];
    }
  }
}
