/*
  Bottom navigation bar that works for guests and authenticated users,
  supporting light and dark mode, and includes a centered add button
  plus icons for home, groups/discover, create post, notifications, and profile.
*/
import 'package:flutter/material.dart';

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
            _buildItem(context, icon: Icons.group, index: 1, activeColor: activeColor, inactiveColor: inactiveColor),

            // ➕ Center button
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
            _buildItem(context, icon: Icons.person, index: 4, activeColor: activeColor, inactiveColor: inactiveColor),
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
          size: isActive ? 27 : 22,
          color: isActive ? activeColor : inactiveColor,
        ),
      ),
    );
  }
}
