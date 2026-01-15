// lib/user/user_follow_fetcher.dart
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

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
      followersCount: (json['followers_count'] ?? 0) as int,
      followingCount: (json['following_count'] ?? 0) as int,
    );
  }
}

class UserFollowFetcher {
  final SupabaseClient supabase = Supabase.instance.client;

  /// Fetch follow stats for ONE user
  Future<UserFollowData?> fetchFollowStats(String userId) async {
    try {
      final data = await supabase
          .from('profiles')
          .select('id, followers_count, following_count')
          .eq('id', userId)
          .single();

      return UserFollowData.fromJson(data);
    } catch (e, stack) {
      debugPrint('❌ fetchFollowStats error: $e');
      debugPrint('📌 stack: $stack');
      return null;
    }
  }
}
