/*
  Defines NotificationData model, loads notifications for the current user,
  builds safe avatar widgets with fallbacks, and links to the Profile page.
*/
import 'package:flutter/material.dart';
import '../profile/profile_page.dart';
import 'push_notification.dart';
import '../../services/api_client.dart';

class NotificationData {
  final String id;
  final String avatar;
  final String message;
  final String time;
  final bool isRead;
  final String? postId;
  final String? type;
  final String? actorId;
  final String? actorUsername;
  final String? actorFullName;

  NotificationData({
    required this.id,
    required this.avatar,
    required this.message,
    required this.time,
    this.isRead = false,
    this.postId,
    this.type,
    this.actorId,
    this.actorUsername,
    this.actorFullName,
  });

  factory NotificationData.fromJson(Map<String, dynamic> json) {
    String avatarUrl = '';
    String? actorUsername;
    String? actorFullName;
    String? actorId;

    if (json['actor'] is Map) {
      final actor = json['actor'] as Map;
      avatarUrl = (actor['avatarUrl'] ?? actor['avatar_url'] ?? '').toString();
      actorUsername = actor['username']?.toString();
      actorFullName = (actor['fullName'] ?? actor['full_name'])?.toString();
      actorId = actor['id']?.toString();
    } else {
      avatarUrl = (json['actor_avatar_url'] ?? '').toString();
      actorUsername = json['actor_username']?.toString();
      actorFullName = json['actor_full_name']?.toString();
      actorId = json['actor_id']?.toString();
    }

    String formattedTime = '';
    final rawDate = json['createdAt'] ?? json['created_at'];
    if (rawDate != null) {
      final parsed = DateTime.tryParse(rawDate.toString());
      if (parsed != null) {
        final now = DateTime.now();
        final diff = now.difference(parsed.toLocal());
        if (diff.inSeconds < 60) {
          formattedTime = 'Just now';
        } else if (diff.inMinutes < 60) {
          formattedTime = '${diff.inMinutes}m ago';
        } else if (diff.inHours < 24) {
          formattedTime = '${diff.inHours}h ago';
        } else if (diff.inDays < 7) {
          formattedTime = '${diff.inDays}d ago';
        } else {
          formattedTime = '${parsed.toLocal()}'.split(' ')[0];
        }
      } else {
        formattedTime = rawDate.toString();
      }
    }

    String rawMessage = (json['message'] ?? '').toString();
    final notifType = json['type']?.toString();

    // Dynamically format like real-life social media if actor is present
    String displayMessage = rawMessage;
    if (actorUsername != null && actorUsername.isNotEmpty) {
      final displayName = (actorFullName != null && actorFullName.isNotEmpty)
          ? '$actorFullName (@$actorUsername)'
          : '@$actorUsername';

      if (notifType == 'follow' || rawMessage.toLowerCase().contains('follower') || rawMessage.toLowerCase().contains('following')) {
        displayMessage = '$displayName started following you';
      } else if (notifType == 'new_post' || rawMessage.toLowerCase().contains('posted')) {
        displayMessage = '$displayName published a new post';
      }
    }

    return NotificationData(
      id: (json['id'] ?? '').toString(),
      avatar: avatarUrl,
      message: displayMessage,
      time: formattedTime,
      isRead: json['isRead'] == true || json['is_read'] == true,
      postId: json['postId']?.toString(),
      type: notifType,
      actorId: actorId,
      actorUsername: actorUsername,
      actorFullName: actorFullName,
    );
  }

  static Future<List<NotificationData>> readNotifications() async {
    if (!ApiClient.instance.isAuthenticated) return [];
    final data = await PushNotificationService.fetchUserNotifications();
    return data.map((e) => NotificationData.fromJson(e)).toList();
  }

  /// Safe, vibrant avatar widget with colored initial fallback
  Widget buildAvatar(BuildContext context, {double size = 48}) {
    final initial = (actorFullName != null && actorFullName!.trim().isNotEmpty)
        ? actorFullName!.trim()[0].toUpperCase()
        : (actorUsername != null && actorUsername!.trim().isNotEmpty
            ? actorUsername!.trim()[0].toUpperCase()
            : 'U');

    final Widget avatarWidget = avatar.isEmpty
        ? CircleAvatar(
            radius: size / 2,
            backgroundColor: _avatarColor(actorUsername ?? 'user'),
            child: Text(
              initial,
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
                fontSize: size * 0.42,
              ),
            ),
          )
        : ClipRRect(
            borderRadius: BorderRadius.circular(size / 2),
            child: Image.network(
              avatar,
              width: size,
              height: size,
              fit: BoxFit.cover,
              errorBuilder: (context, error, stackTrace) {
                return CircleAvatar(
                  radius: size / 2,
                  backgroundColor: _avatarColor(actorUsername ?? 'user'),
                  child: Text(
                    initial,
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: size * 0.42,
                    ),
                  ),
                );
              },
            ),
          );

    return InkWell(
      borderRadius: BorderRadius.circular(size / 2),
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => const ProfilePage()),
        );
      },
      child: avatarWidget,
    );
  }

  static Color _avatarColor(String text) {
    const colors = [
      Color(0xFF6366F1), // Indigo
      Color(0xFF8B5CF6), // Purple
      Color(0xFFEC4899), // Pink
      Color(0xFFF97316), // Orange
      Color(0xFF10B981), // Emerald
      Color(0xFF06B6D4), // Cyan
      Color(0xFF3B82F6), // Blue
    ];
    int hash = 0;
    for (int i = 0; i < text.length; i++) {
      hash = text.codeUnitAt(i) + ((hash << 5) - hash);
    }
    return colors[hash.abs() % colors.length];
  }
}
