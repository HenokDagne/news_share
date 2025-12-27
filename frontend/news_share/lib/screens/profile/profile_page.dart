import 'package:flutter/material.dart';
import '../home/top_app_bar.dart';
import '../home/bottom_nav.dart';
import '../home/home_page.dart';
import '../post/post_page.dart';
import '../notification/notification_page.dart';
import 'statItem.dart';
import 'profileItem.dart';

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
        setState(() => _currentIndex = i);
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
    body: LayoutBuilder(
      builder: (context, constraints) {
        final double maxBodyHeight = constraints.maxHeight; // full screen height

        // height from top of screen down to where profile content starts
        const double profileTop = 140;
        final double availableForProfile = maxBodyHeight - profileTop;

        return Stack(
          clipBehavior: Clip.none,
          children: [
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
            Positioned(
              left: 16,
              right: 16,
              top: profileTop,
              child: ConstrainedBox(
                constraints: BoxConstraints(
                  // force the whole Column (including Profileitem) to fit
                  maxHeight: availableForProfile,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // avatar, texts, stats...
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
                    const SizedBox(height: 2),
                    const Text(
                      'John Doe',
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w900,
                        fontFamily: 'Arial',
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text('john@example.com'),
                    const SizedBox(height: 6),
                    const Text('News enthusiast | Tech lover'),
                    const SizedBox(height: 12),
                    const Divider(thickness: 1, color: Color(0xFFECECEC)),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: const [
                        Expanded(child: StatItem(value: '156', label: 'Posts')),
                        Expanded(child: StatItem(value: '2.4K', label: 'Followers')),
                        Expanded(child: StatItem(value: '892', label: 'Following')),
                      ],
                    ),
                    const SizedBox(height: 16),

                    // Let Profileitem use remaining space but not overflow
                    const Expanded(
                      child: Profileitem(),
                    ),
                  ],
                ),
              ),
            ),
          ],
        );
      },
    ),
    bottomNavigationBar: BottomNavBar(
      currentIndex: _currentIndex,
      onChanged: _onNavTap,
    ),
  );
}

}
