/*
  Fetches a single user’s follow stats from NestJS API (followers/following counts),
  maps them into UserFollowData, and returns null on failure.
*/

import 'package:flutter/material.dart';
import '../../services/api_client.dart';

class UserFollowData {
  final String id;
  final int followersCount;
  final int followingCount;

  UserFollowData({
    required this.id,
    required this.followersCount,
    required this.followingCount,
  });

  factory UserFollowData.fromJson(Map<String, dynamic> json) {
    return UserFollowData(
      id: json['id'] as String,
      followersCount: (json['followersCount'] ?? json['followers_count'] ?? 0) as int,
      followingCount: (json['followingCount'] ?? json['following_count'] ?? 0) as int,
    );
  }
}

class UserFollowFetcher {
  /// Fetch follow stats for ONE user
  Future<UserFollowData?> fetchFollowStats(String userId) async {
    try {
      final data = await ApiClient.instance.getUserProfile(userId);
      return UserFollowData.fromJson(data);
    } catch (e, stack) {
      debugPrint('fetchFollowStats error: $e');
      debugPrint(' stack: $stack');
      return null;
    }
  }
}
