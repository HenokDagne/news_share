/*
  Handles follow/unfollow operations via the NestJS REST API,
  checks follow status, and can fetch follower/following counts.
*/
import '../../services/api_client.dart';

class FollowHandler {
  /// Follow the target user
  Future<void> follow(String targetUserId) async {
    try {
      await ApiClient.instance.follow(targetUserId);
    } catch (e, stack) {
      print('Follow error: $e');
      print('Stack trace: $stack');
    }
  }

  /// Unfollow the target user
  Future<void> unfollow(String targetUserId) async {
    try {
      await ApiClient.instance.unfollow(targetUserId);
    } catch (e, stack) {
      print('Unfollow error: $e');
      print('Stack trace: $stack');
    }
  }

  /// Check if the currently authenticated user follows the target user
  Future<bool> isFollowing(String targetUserId) async {
    try {
      if (!ApiClient.instance.isAuthenticated) {
        return false;
      }

      final status = await ApiClient.instance.getFollowStatus(targetUserId);
      return status['isFollowing'] == true;
    } catch (e, stack) {
      print('isFollowing error: $e');
      print('Stack trace: $stack');
      return false;
    }
  }

  /// Fetch the number of followers/following for a specific user
  Future<Map<String, int>> fetchFollowCounts(String userId) async {
    try {
      final data = await ApiClient.instance.getUserProfile(userId);
      return {
        'followers_count': (data['followersCount'] ?? data['followers_count'] ?? 0) as int,
        'following_count': (data['followingCount'] ?? data['following_count'] ?? 0) as int,
      };
    } catch (e, stack) {
      print('fetchFollowCounts error: $e');
      print('Stack trace: $stack');
      return {'followers_count': 0, 'following_count': 0};
    }
  }
}
