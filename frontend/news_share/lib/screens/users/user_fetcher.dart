/*
  Fetches users from the NestJS REST API,
  and returns all except the currently logged-in user as UserItem models.
*/

import 'package:flutter/material.dart';
import '../../services/api_client.dart';
import 'user_model.dart';

class UserFetcher {
  /// Fetch all users from API except the current logged-in user
  Future<List<UserItem>> fetchUsers() async {
    try {
      final currentUserId = ApiClient.instance.currentUserId;
      final data = await ApiClient.instance.getUsers();

      return data
          .map((e) => UserItem.fromJson(e))
          .where((user) => user.id != currentUserId)
          .toList();
    } catch (e) {
      debugPrint('Error fetching users: $e');
      return [];
    }
  }
}
