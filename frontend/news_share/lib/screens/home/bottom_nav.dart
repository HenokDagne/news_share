import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../auth/login.dart'; // Adjust path

class BottomNavBar extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onChanged;

  const BottomNavBar({
    super.key,
    required this.currentIndex,
    required this.onChanged,
  });

  /// Check if user is logged in
  bool get _isAuthenticated {
    return Supabase.instance.client.auth.currentUser != null;
  }

  /// Handle taps with auth check
  void _handleTap(BuildContext context, int index) {
    if (!_isAuthenticated) {
      // 🚨 User not authenticated → redirect to login
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('You must login first')),
      );

      Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => const LoginPage()),
      );
      return; // Stop further navigation
    }

    // ✅ Authenticated → navigate
    onChanged(index);
  }

  @override
  Widget build(BuildContext context) {
    return BottomAppBar(
      color: Colors.white,
      elevation: 8,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 6),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            _buildItem(context, icon: Icons.home, index: 0),
            _buildItem(context, icon: Icons.search, index: 1),

            // ➕ Center button
            GestureDetector(
              onTap: () => _handleTap(context, 2),
              child: Container(
                height: 52,
                width: 52,
                decoration: BoxDecoration(
                  color: const Color.fromRGBO(242, 242, 249, 1),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: Colors.black, width: 2),
                ),
                child: const Icon(Icons.add, color: Colors.black, size: 28),
              ),
            ),

            _buildItem(context, icon: Icons.notifications, index: 3),
            _buildItem(context, icon: Icons.person, index: 4),
          ],
        ),
      ),
    );
  }

  Widget _buildItem(
    BuildContext context, {
    required IconData icon,
    required int index,
  }) {
    final bool isActive = index == currentIndex;

    return InkWell(
      onTap: () => _handleTap(context, index),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
        width: isActive ? 56 : 40,
        height: 40,
        alignment: Alignment.center,
        child: Icon(
          icon,
          size: isActive ? 28 : 22,
          color: isActive
              ? const Color.fromARGB(255, 15, 15, 17)
              : Colors.grey,
        ),
      ),
    );
  }
}
