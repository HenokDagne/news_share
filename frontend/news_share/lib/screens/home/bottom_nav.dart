/*
  Bottom navigation bar that works for guests and authenticated users,
  supporting light and dark mode, and includes a centered add button
  plus icons for home, search/explore, create post, notifications, and profile avatar.
*/
import 'package:flutter/material.dart';
import '../../services/api_client.dart';

class BottomNavBar extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onChanged;
  final bool isDark;

  const BottomNavBar({
    super.key,
    required this.currentIndex,
    required this.onChanged,
    this.isDark = false,
  });

  String? _resolveAvatarUrl(String? raw) {
    if (raw == null || raw.trim().isEmpty) return null;
    final trimmed = raw.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    final base = ApiClient.instance.baseUrl;
    return trimmed.startsWith('/') ? '$base$trimmed' : '$base/$trimmed';
  }

  @override
  Widget build(BuildContext context) {
    final bgColor = isDark ? Colors.black : Colors.white;
    final activeColor = isDark ? Colors.white : const Color.fromARGB(255, 15, 15, 17);
    final inactiveColor = isDark ? Colors.grey.shade600 : Colors.grey;

    return BottomAppBar(
      color: bgColor,
      elevation: isDark ? 0 : 8,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 6),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            _buildItem(context, icon: Icons.home, index: 0, activeColor: activeColor, inactiveColor: inactiveColor),
            // 🔍 Search / Explore item (replaced old group icon)
            _buildItem(context, icon: Icons.search, index: 1, activeColor: activeColor, inactiveColor: inactiveColor),

            // ➕ Center create post button
            GestureDetector(
              onTap: () => onChanged(2),
              child: Container(
                height: 48,
                width: 48,
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF181B22) : const Color.fromRGBO(242, 242, 249, 1),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: isDark ? Colors.white70 : Colors.black, width: 1.5),
                ),
                child: Icon(Icons.add, color: isDark ? Colors.white : Colors.black, size: 26),
              ),
            ),

            _buildItem(context, icon: Icons.notifications, index: 3, activeColor: activeColor, inactiveColor: inactiveColor),
            
            // 👤 Profile photo / avatar item (like Instagram)
            _buildProfileAvatarItem(context, index: 4, activeColor: activeColor, inactiveColor: inactiveColor),
          ],
        ),
      ),
    );
  }

  Widget _buildItem(
    BuildContext context, {
    required IconData icon,
    required int index,
    required Color activeColor,
    required Color inactiveColor,
  }) {
    final bool isActive = index == currentIndex;

    return InkWell(
      onTap: () => onChanged(index),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
        width: isActive ? 52 : 40,
        height: 40,
        alignment: Alignment.center,
        child: Icon(
          icon,
          size: isActive ? 28 : 23,
          color: isActive ? activeColor : inactiveColor,
        ),
      ),
    );
  }

  Widget _buildProfileAvatarItem(
    BuildContext context, {
    required int index,
    required Color activeColor,
    required Color inactiveColor,
  }) {
    final bool isActive = index == currentIndex;
    final currentUser = ApiClient.instance.currentUser;
    final avatarUrl = _resolveAvatarUrl(currentUser?.avatarUrl);

    return InkWell(
      onTap: () => onChanged(index),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
        width: isActive ? 52 : 40,
        height: 40,
        alignment: Alignment.center,
        child: Container(
          width: isActive ? 28 : 24,
          height: isActive ? 28 : 24,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(
              color: isActive ? activeColor : Colors.transparent,
              width: 1.8,
            ),
          ),
          padding: const EdgeInsets.all(1.5),
          child: Container(
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: isDark ? const Color(0xFF262626) : Colors.grey.shade300,
            ),
            clipBehavior: Clip.antiAlias,
            child: avatarUrl != null
                ? Image.network(
                    avatarUrl,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => _avatarFallback(currentUser?.username, isActive, activeColor, inactiveColor),
                  )
                : _avatarFallback(currentUser?.username, isActive, activeColor, inactiveColor),
          ),
        ),
      ),
    );
  }

  Widget _avatarFallback(String? username, bool isActive, Color activeColor, Color inactiveColor) {
    if (username != null && username.isNotEmpty) {
      return Center(
        child: Text(
          username[0].toUpperCase(),
          style: TextStyle(
            fontSize: isActive ? 12 : 11,
            fontWeight: FontWeight.bold,
            color: isActive ? activeColor : inactiveColor,
          ),
        ),
      );
    }
    return Icon(
      Icons.person,
      size: isActive ? 18 : 15,
      color: isActive ? activeColor : inactiveColor,
    );
  }
}
