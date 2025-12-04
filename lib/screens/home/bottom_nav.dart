import 'package:flutter/material.dart';

class BottomNavBar extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onChanged;

  const BottomNavBar({
    super.key,
    required this.currentIndex,
    required this.onChanged,
  });

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
            _buildItem(icon: Icons.home, index: 0),
            _buildItem(icon: Icons.search, index: 1),
            GestureDetector(
              onTap: () => onChanged(2),
              child: Container(
                height: 52,
                width: 52,
                decoration: BoxDecoration(
                  color: const Color(0xFF2563EB),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(Icons.add, color: Colors.white),
              ),
            ),
            _buildItem(icon: Icons.notifications, index: 3),
            _buildItem(icon: Icons.person, index: 4),
          ],
        ),
      ),
    );
  }

  Widget _buildItem({required IconData icon, required int index}) {
    final color = index == currentIndex ? const Color(0xFF2563EB) : Colors.grey;
    return InkWell(
      onTap: () => onChanged(index),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 6),
        child: Icon(icon, color: color),
      ),
    );
  }
}
