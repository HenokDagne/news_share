/*
  Fetches public posts from NestJS backend API,
  ordering by newest first and returning an empty list on errors.
*/

import '../../services/api_client.dart';

class PostFetcher {
  /// Fetch posts ordered by creation date descending
  Future<List<Map<String, dynamic>>> fetchPosts() async {
    try {
      final posts = await ApiClient.instance.getPosts();

      return posts.map((post) {
        final author = post['author'] as Map<String, dynamic>?;
        return {
          'id': post['id'],
          'user_id': author?['id'] ?? post['userId'],
          'title': post['title'],
          'content': post['content'],
          'image_url': post['imageUrl'],
          'imageUrl': post['imageUrl'],
          'created_at': post['createdAt'],
          'createdAt': post['createdAt'],
          'author': author,
        };
      }).toList();
    } catch (e) {
      print('Error fetching posts: $e');
      return [];
    }
  }
}
