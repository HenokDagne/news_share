/* NotificationPage shows the notifications list via FutureBuilder,
   renders avatars/messages/timestamps, and wires bottom navigation
   to Home, Users, Post, Notifications, and Profile tabs. */
import 'package:flutter/material.dart';

import '../home/top_app_bar.dart';
import '../home/bottom_nav.dart';
import '../home/home_page.dart';
import '../post/post_page.dart';
import '../profile/profile_page.dart';
import 'notification.dart';
import '../users/user_list.dart';
import '../auth/login.dart';
import '../../services/api_client.dart';

class NotificationPage extends StatefulWidget {
  const NotificationPage({super.key});

  @override
  State<NotificationPage> createState() => _NotificationPageState();
}

class _NotificationPageState extends State<NotificationPage> {
  int _currentIndex = 3; // notifications tab
  late Future<List<NotificationData>> _notificationsFuture;

  @override
  void initState() {
    super.initState();
    _notificationsFuture = NotificationData.readNotifications();
  }

  void _onNavTap(int i) {
    if (i == _currentIndex) return;
    switch (i) {
      case 0:
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => const HomePage()),
        );
        break;
      case 1:
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => const UserListPage()),
        );
        break;
      case 2:
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => const PostPage()),
        );
        break;
      case 3:
        return; // already here (NotificationPage)
      case 4:
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => const ProfilePage()),
        );
        break;
      default:
        setState(() => _currentIndex = i);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isAuthenticated = ApiClient.instance.isAuthenticated;

    return Scaffold(
      backgroundColor: const Color(0xFFc0c1c3),
      appBar: const PreferredSize(
        preferredSize: Size.fromHeight(70),
        child: TopAppBar(),
      ),
      body: Container(
        color: Colors.white,
        margin: const EdgeInsets.only(top: 4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              child: Text(
                'Notification',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
              ),
            ),
            Expanded(
              child: isAuthenticated
                  ? FutureBuilder<List<NotificationData>>(
                      future: _notificationsFuture,
                      builder: (context, snapshot) {
                        if (snapshot.connectionState ==
                            ConnectionState.waiting) {
                          return const Center(
                            child: CircularProgressIndicator(),
                          );
                        }
                        if (snapshot.hasError) {
                          return Center(
                            child: Text('Error: ${snapshot.error}'),
                          );
                        }
                        final items = snapshot.data ?? [];
                        if (items.isEmpty) {
                          return const Center(child: Text('No notifications'));
                        }

                        return ListView.builder(
                          itemCount: items.length,
                          itemBuilder: (context, index) {
                            final n = items[index];
                            final isFollow = n.type == 'follow' || n.message.toLowerCase().contains('follow');

                            return Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 16,
                                vertical: 6,
                              ),
                              child: Material(
                                color: Colors.transparent,
                                child: InkWell(
                                  borderRadius: BorderRadius.circular(14),
                                  onTap: () async {
                                    if (!n.isRead) {
                                      try {
                                        await ApiClient.instance.markNotificationRead(n.id);
                                        setState(() {
                                          _notificationsFuture = NotificationData.readNotifications();
                                        });
                                      } catch (_) {}
                                    }
                                  },
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 14,
                                      vertical: 12,
                                    ),
                                    decoration: BoxDecoration(
                                      color: n.isRead ? Colors.white : const Color(0xFFF0F5FF),
                                      borderRadius: BorderRadius.circular(14),
                                      border: Border.all(
                                        color: n.isRead ? Colors.grey.shade200 : const Color(0xFFC7D7FE),
                                        width: 1,
                                      ),
                                      boxShadow: [
                                        BoxShadow(
                                          color: Colors.black.withOpacity(0.04),
                                          blurRadius: 8,
                                          offset: const Offset(0, 2),
                                        ),
                                      ],
                                    ),
                                    child: Row(
                                      crossAxisAlignment: CrossAxisAlignment.center,
                                      children: [
                                        Stack(
                                          clipBehavior: Clip.none,
                                          children: [
                                            n.buildAvatar(context, size: 48),
                                            Positioned(
                                              bottom: -2,
                                              right: -2,
                                              child: Container(
                                                padding: const EdgeInsets.all(3),
                                                decoration: BoxDecoration(
                                                  color: isFollow ? const Color(0xFF3B82F6) : const Color(0xFF10B981),
                                                  shape: BoxShape.circle,
                                                  border: Border.all(color: Colors.white, width: 1.5),
                                                ),
                                                child: Icon(
                                                  isFollow ? Icons.person_add : Icons.article,
                                                  size: 11,
                                                  color: Colors.white,
                                                ),
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(width: 12),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              RichText(
                                                maxLines: 2,
                                                overflow: TextOverflow.ellipsis,
                                                text: TextSpan(
                                                  style: const TextStyle(fontSize: 13, color: Colors.black87),
                                                  children: [
                                                    if (n.actorFullName != null && n.actorFullName!.trim().isNotEmpty)
                                                      TextSpan(
                                                        text: '${n.actorFullName!.trim()} ',
                                                        style: const TextStyle(fontWeight: FontWeight.bold),
                                                      ),
                                                    if (n.actorUsername != null && n.actorUsername!.trim().isNotEmpty)
                                                      TextSpan(
                                                        text: '@${n.actorUsername!.trim()} ',
                                                        style: TextStyle(
                                                          fontWeight: FontWeight.w600,
                                                          color: Colors.blue.shade800,
                                                        ),
                                                      ),
                                                    if (n.actorUsername != null && n.actorUsername!.trim().isNotEmpty)
                                                      TextSpan(
                                                        text: isFollow
                                                            ? 'started following you'
                                                            : 'published a new post',
                                                        style: TextStyle(
                                                          color: Colors.grey.shade800,
                                                        ),
                                                      )
                                                    else
                                                      TextSpan(
                                                        text: n.message.isNotEmpty
                                                            ? n.message
                                                            : (isFollow
                                                                ? 'You have a new follower!'
                                                                : 'You have a new notification!'),
                                                        style: TextStyle(
                                                          fontWeight: FontWeight.w500,
                                                          color: Colors.grey.shade900,
                                                        ),
                                                      ),
                                                  ],
                                                ),
                                              ),
                                              const SizedBox(height: 4),
                                              Row(
                                                children: [
                                                  Icon(
                                                    Icons.access_time,
                                                    size: 12,
                                                    color: Colors.grey.shade500,
                                                  ),
                                                  const SizedBox(width: 4),
                                                  Text(
                                                    n.time,
                                                    style: TextStyle(
                                                      fontSize: 11,
                                                      color: Colors.grey.shade600,
                                                      fontWeight: FontWeight.w500,
                                                    ),
                                                  ),
                                                  if (!n.isRead) ...[
                                                    const SizedBox(width: 8),
                                                    Container(
                                                      width: 6,
                                                      height: 6,
                                                      decoration: const BoxDecoration(
                                                        color: Color(0xFF3B82F6),
                                                        shape: BoxShape.circle,
                                                      ),
                                                    ),
                                                  ],
                                                ],
                                              ),
                                            ],
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                            );
                          },
                        );
                      },
                    )
                  : Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(
                              Icons.notifications_off_outlined,
                              size: 72,
                            ),
                            const SizedBox(height: 16),
                            const Text(
                              'Sign in to view notifications',
                              style: TextStyle(
                                fontSize: 22,
                                fontWeight: FontWeight.bold,
                              ),
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: 8),
                            const Text(
                              'Notifications stay private to each account.',
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: 20),
                            ElevatedButton(
                              onPressed: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => const LoginPage(),
                                  ),
                                );
                              },
                              child: const Text('Sign In'),
                            ),
                          ],
                        ),
                      ),
                    ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: BottomNavBar(
        currentIndex: _currentIndex,
        onChanged: _onNavTap,
      ),
    );
  }
}
