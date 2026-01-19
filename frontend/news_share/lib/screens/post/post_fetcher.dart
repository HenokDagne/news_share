/*
  Fetches posts for the current logged-in user from Supabase,
  ordering by newest first and returning an empty list on errors.
*/

import 'package:supabase_flutter/supabase_flutter.dart';

class PostFetcher {
  final SupabaseClient supabase = Supabase.instance.client;

  /// Fetch only posts of the current logged-in user, ordered by creation date descending
  Future<List<Map<String, dynamic>>> fetchPosts() async {
    try {
      final currentUser = supabase.auth.currentUser;
      final currentUserId = currentUser?.id;
      if (currentUserId == null) {
        return [];
      }
      final data = await supabase
          .from('posts')
          .select('id, user_id, title, content, image_url, created_at')
          .eq('user_id', currentUserId)
          .order('created_at', ascending: false);

      return List<Map<String, dynamic>>.from(data);
    } catch (e) {
      print('Error fetching posts: $e');
      return [];
    }
  }
}
