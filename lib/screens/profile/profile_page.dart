import 'package:flutter/material.dart';
import '../home/top_app_bar.dart';
import '../home/bottom_nav.dart';
import '../home/home_page.dart';
import '../post/post_page.dart';
import '../notification/notification_page.dart';

class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  int _currentIndex = 4;

  void _onNavTap(int i) {
    if (i == _currentIndex) return;
    switch (i) {
      case 0:
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => const HomePage()),
        );
        break;
      case 2:
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => const PostPage()),
        );
        break;
      case 3:
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => const NotificationPage()),
        );
        break;
      case 4:
        return; // already here
      default:
        setState(() => _currentIndex = i); // stub for other tabs
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: const PreferredSize(
        preferredSize: Size.fromHeight(70),
        child: TopAppBar(),
      ),
      body: Stack(
        clipBehavior: Clip.none,
        children: [
          // Header banner with gradient
          Container(
            height: 200,
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFF667EEA), Color(0xFF764BA2)],
              ),
            ),
          ),

          // Content below the header
          Positioned.fill(
            top: 200,
            child: Container(
              color: Colors.white,
              padding: const EdgeInsets.fromLTRB(16, 80, 16, 0),
              alignment: Alignment.topLeft,
              child: const Text(
                'John Doe',
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: Colors.black,
                ),
              ),
            ),
          ),

          // Overlapping avatar with white ring at the bottom-left, above body
          // ...existing code...
          Positioned(
            left: 16,
            top: 140,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 120,
                  height: 120,
                  padding: const EdgeInsets.all(3),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.white,
                    boxShadow: const [
                      BoxShadow(
                        color: Colors.black12,
                        blurRadius: 8,
                        offset: Offset(0, 4),
                      ),
                    ],
                  ),
                  child: const CircleAvatar(
                    backgroundColor: Color(0xFF6C6CD1),
                    child: Icon(
                      Icons.person,
                      color: Color(0xFF4D4DB0),
                      size: 64,
                    ),
                  ),
                ),
                const SizedBox(height: 2), // space below avatar
                Container(
                alignment: Alignment.topLeft,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Text(
                    'John Doe',
                    style: TextStyle(
                      fontSize: 30,
                      fontWeight: FontWeight.w900,
                      color: Color.fromARGB(255, 24, 23, 23),
                      fontFamily: 'Arial',
                    ),
                  ),
                ),

                Container(
                  height: 50,
                  width: 300,
                  color: Colors.black,
                )
              ],
            ),
          ),
          // ...existing code...
        ],
      ),
      bottomNavigationBar: BottomNavBar(
        currentIndex: _currentIndex,
        onChanged: _onNavTap,
      ),
    );
  }
}
