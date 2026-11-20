/*
  Deletes a post via the NestJS REST API (author only).
*/
import '../../services/api_client.dart';

class DeletePostService {
  static Future<void> deletePost(String postId) async {
    if (!ApiClient.instance.isAuthenticated) {
      throw Exception('User not logged in');
    }
    await ApiClient.instance.deletePost(postId);
  }
}
