import 'package:supabase_flutter/supabase_flutter.dart';

class PostFetcher {
  final SupabaseClient supabase = Supabase.instance.client;

  /// Fetch all posts ordered by creation date descending
  Future<List<Map<String, dynamic>>> fetchPosts() async {
    try {
      final data = await supabase
          .from('posts')
          .select('id, user_id, title, content, image_url, created_at')
          .order('created_at', ascending: false);

      return List<Map<String, dynamic>>.from(data);
    } catch (e) {
      print('Error fetching posts: $e');
      return [];
    }
  }
}
