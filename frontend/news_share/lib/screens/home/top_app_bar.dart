/*
  Builds the home top app bar with title and action icons,
  styled for the news feed and ready for search/filter actions.
*/

import 'package:flutter/material.dart';
import '../../services/api_client.dart';
import '../activity/activity_page.dart';
import '../notification/notification_page.dart';
import '../profile/profile_page.dart';
import '../auth/login.dart';

class TopAppBar extends StatefulWidget {
  const TopAppBar({super.key});

  @override
  State<TopAppBar> createState() => _TopAppBarState();
}

class _TopAppBarState extends State<TopAppBar> {
  String? avatarUrl;
  int unreadNotifications = 0;

  @override
  void initState() {
    super.initState();
    _fetchUserData();
  }

  Future<void> _fetchUserData() async {
    try {
      if (!ApiClient.instance.isAuthenticated) return;

      setState(() {
        avatarUrl = ApiClient.instance.currentUser?.avatarUrl;
      });

      final count = await ApiClient.instance.getUnreadNotificationCount();
      if (mounted) {
        setState(() {
          unreadNotifications = count;
        });
      }
    } catch (e) {
      debugPrint('TopAppBar fetch error: $e');
    }
  }

  // ---------------- LOGOUT FUNCTION ----------------
  Future<void> _logout() async {
    try {
      await ApiClient.instance.logout();
      if (mounted) {
        setState(() {
          avatarUrl = null;
        });
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => const LoginPage()),
        );
      }
    } catch (e) {
      debugPrint('Logout error: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final isLoggedIn = ApiClient.instance.isAuthenticated;

    return Container(
      color: Colors.white,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: SafeArea(
        bottom: false,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'NewsShare',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: Color(0xFF2563EB),
              ),
            ),

            Row(
              children: [
                // Notifications
                if (isLoggedIn) ...[
                  IconButton(
                    tooltip: 'Activity & Moderation History',
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const ActivityPage(),
                        ),
                      );
                    },
                    icon: const Icon(Icons.history_outlined),
                  ),
                  Stack(
                    clipBehavior: Clip.none,
                    children: [
                      IconButton(
                        onPressed: () {
                          Navigator.pushReplacement(
                            context,
                            MaterialPageRoute(
                              builder: (_) => const NotificationPage(),
                            ),
                          );
                        },
                        icon: const Icon(Icons.notifications_none),
                      ),
                      if (unreadNotifications > 0)
                        Positioned(
                          right: 6,
                          top: 6,
                          child: Container(
                            padding: const EdgeInsets.all(4),
                            decoration: const BoxDecoration(
                              color: Colors.red,
                              shape: BoxShape.circle,
                            ),
                            child: Text(
                              '$unreadNotifications',
                              style: const TextStyle(color: Colors.white, fontSize: 10),
                            ),
                          ),
                        ),
                    ],
                  ),
                ],

                const SizedBox(width: 8),

                // Profile avatar (only if logged in)
                if (isLoggedIn)
                  GestureDetector(
                    onTap: () {
                      Navigator.pushReplacement(
                        context,
                        MaterialPageRoute(builder: (_) => const ProfilePage()),
                      );
                    },
                    child: Container(
                      padding: const EdgeInsets.all(2),
                      decoration: const BoxDecoration(
                        color: Color.fromARGB(255, 237, 58, 207),
                        shape: BoxShape.circle,
                      ),
                      child: CircleAvatar(
                        radius: 20,
                        backgroundColor: const Color(0xFF7C3AED),
                        backgroundImage:
                            avatarUrl != null && avatarUrl!.isNotEmpty
                            ? NetworkImage(avatarUrl!)
                            : null,
                        child: avatarUrl == null
                            ? const Icon(
                                Icons.person,
                                color: Colors.white,
                                size: 20,
                              )
                            : null,
                      ),
                    ),
                  ),

                const SizedBox(width: 8),

                // LOGIN / LOGOUT BUTTON
                GestureDetector(
                  onTap: () {
                    if (isLoggedIn) {
                      _logout();
                    } else {
                      Navigator.pushReplacement(
                        context,
                        MaterialPageRoute(builder: (_) => const LoginPage()),
                      );
                    }
                  },
                  child: CircleAvatar(
                    radius: 20,
                    backgroundColor: Colors.transparent,
                    child: Icon(
                      isLoggedIn ? Icons.logout : Icons.login,
                      color: isLoggedIn ? Colors.red : Colors.black,
                      size: 20,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
