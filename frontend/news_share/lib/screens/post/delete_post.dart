import 'package:supabase_flutter/supabase_flutter.dart';

class DeletePostService {
  static Future<void> deletePost(String postId) async {
    final response = await Supabase.instance.client
        .from('posts')
        .delete()
        .eq('id', postId);
    // Optionally, check for errors if using postgrest v1
    // if (response.error != null) {
    //   throw Exception('Failed to delete post: \\${response.error!.message}');
    // }
  }
}
