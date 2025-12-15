// lib/notification/notification.dart
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle;
import '../profile/profile_page.dart';

class NotificationData {
  final String avatar;
  final String message;
  final String time;

  NotificationData({
    required this.avatar,
    required this.message,
    required this.time,
  });

  factory NotificationData.fromJson(Map<String, dynamic> json) {
    return NotificationData(
      avatar: json['avatar'] ?? '',
      message: json['message'] ?? '',
      time: json['time'] ?? '',
    );
  }

  // static loader from assets/notification.json
  static Future<List<NotificationData>> readNotifications() async {
    final String response = await rootBundle.loadString(
      'assets/notification.json',
    );
    final List<dynamic> data = jsonDecode(response);
    return data
        .map((e) => NotificationData.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Safe avatar widget with fallback if network image fails
Widget buildAvatar(BuildContext context, {double size = 50}) {
  final Widget avatarWidget = avatar.isEmpty
      ? _fallbackAvatar(context, size)
      : ClipRRect(
          borderRadius: BorderRadius.circular(size / 2),
          child: Image.network(
            avatar,
            width: size,
            height: size,
            fit: BoxFit.cover,
            errorBuilder: (context, error, stackTrace) {
              return _fallbackAvatar(context, size);
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


  Widget _fallbackAvatar(BuildContext context, double size) {
    return CircleAvatar(
      radius: size / 2,
      backgroundColor: Colors.grey.shade300,
      child: IconButton(
        icon: const Icon(Icons.person, color: Colors.white),
        tooltip: 'View profile',
        onPressed: () {
          // navigate to profile page
          Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const ProfilePage()),
          );
        },
      ),
    );
  }
}
