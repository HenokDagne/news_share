// lib/notification/notification.dart
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle;

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
    final String response =
        await rootBundle.loadString('assets/notification.json');
    final List<dynamic> data = jsonDecode(response);
    return data
        .map((e) => NotificationData.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Safe avatar widget with fallback if network image fails
  Widget buildAvatar({double size = 50}) {
    if (avatar.isEmpty) {
      return _fallbackAvatar(size);
    }

    return ClipRRect(
      borderRadius: BorderRadius.circular(size / 2),
      child: Image.network(
        avatar,
        width: size,
        height: size,
        fit: BoxFit.cover,
        errorBuilder: (context, error, stackTrace) {
          // If network fails, show local / placeholder avatar
          return _fallbackAvatar(size);
        },
      ),
    );
  }

  Widget _fallbackAvatar(double size) {
    return CircleAvatar(
      radius: size / 2,
      backgroundColor: Colors.grey.shade300,
      child: const Icon(Icons.person, color: Colors.white),
    );
  }
}
