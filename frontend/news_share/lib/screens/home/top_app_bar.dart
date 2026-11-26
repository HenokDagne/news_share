/*
  Instagram-Style Common Top Navigation Bar:
  - Unified component shared across Home, Explore/Search, and Notification pages.
  - OLED True Black (#000000) background with subtle bottom divider (#262626).
  - Modes:
    1. Home: Brand wordmark ("NewsShare ⌄") with dropdown for Following/Favorites,
       Search action, Heart notification icon with unread badge, and Direct Message (Chat) icon.
    2. Search / Explore: Integrated Instagram rounded pill search input with magnifying glass,
       clear button, filter tune icon, and notification badge.
    3. Notifications: Contextual title ("Notifications" in crisp bold white typography),
       Search shortcut, highlighted Heart icon, and Direct Message (Chat) icon.
*/

import 'package:flutter/material.dart';
import '../../services/api_client.dart';
import '../activity/activity_page.dart';
import '../notification/notification_page.dart';
import '../profile/profile_page.dart';
import '../users/user_list.dart';
import '../auth/login.dart';
import '../messages/conversations_list_screen.dart';

enum TopNavBarType {
  home,
  search,
  notifications,
}

class InstagramTopNavBar extends StatefulWidget implements PreferredSizeWidget {
  final TopNavBarType pageType;
  final String? title;
  final TextEditingController? searchController;
  final ValueChanged<String>? onSearchChanged;
  final VoidCallback? onClearSearch;
  final VoidCallback? onFilterTap;
  final VoidCallback? onSearchToggle;
  final bool isSearchExpanded;
  final bool showHeart;
  final bool showMessages;
  final bool showBackButton;

  const InstagramTopNavBar({
    super.key,
    this.pageType = TopNavBarType.home,
    this.title,
    this.searchController,
    this.onSearchChanged,
    this.onClearSearch,
    this.onFilterTap,
    this.onSearchToggle,
    this.isSearchExpanded = false,
    this.showHeart = true,
    this.showMessages = true,
    this.showBackButton = false,
  });

  @override
  Size get preferredSize => Size.fromHeight(
        (pageType == TopNavBarType.home && isSearchExpanded) ? 104.0 : 54.0,
      );

  @override
  State<InstagramTopNavBar> createState() => _InstagramTopNavBarState();
}

class _InstagramTopNavBarState extends State<InstagramTopNavBar> {
  String? _avatarUrl;
  int _unreadNotifications = 0;

  @override
  void initState() {
    super.initState();
    _fetchUserData();
  }

  Future<void> _fetchUserData() async {
    try {
      if (!ApiClient.instance.isAuthenticated) return;

      if (mounted) {
        setState(() {
          _avatarUrl = ApiClient.instance.currentUser?.avatarUrl;
        });
      }

      final count = await ApiClient.instance.getUnreadNotificationCount();
      if (mounted) {
        setState(() {
          _unreadNotifications = count;
        });
      }
    } catch (e) {
      debugPrint('InstagramTopNavBar fetch error: $e');
    }
  }

  void _showFeedSelectorMenu(BuildContext context, TapDownDetails details) {
    final position = details.globalPosition;
    showMenu<String>(
      context: context,
      position: RelativeRect.fromLTRB(position.dx, position.dy + 10, position.dx + 180, position.dy + 120),
      color: const Color(0xFF1E222B),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: const BorderSide(color: Color(0xFF262626)),
      ),
      items: [
        PopupMenuItem<String>(
          value: 'following',
          child: Row(
            children: const [
              Icon(Icons.people_alt_outlined, color: Colors.white, size: 20),
              SizedBox(width: 12),
              Text(
                'Following',
                style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600),
              ),
            ],
          ),
        ),
        PopupMenuItem<String>(
          value: 'favorites',
          child: Row(
            children: const [
              Icon(Icons.star_outline_rounded, color: Colors.white, size: 20),
              SizedBox(width: 12),
              Text(
                'Favorites',
                style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600),
              ),
            ],
          ),
        ),
      ],
    ).then((value) {
      if (value != null && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Switched feed to $value'),
            duration: const Duration(seconds: 1),
            backgroundColor: const Color(0xFF1E222B),
          ),
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.black,
        border: Border(
          bottom: BorderSide(color: Color(0xFF262626), width: 0.8),
        ),
      ),
      child: SafeArea(
        bottom: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Primary Nav Row
            SizedBox(
              height: 52,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14),
                child: widget.pageType == TopNavBarType.search
                    ? _buildSearchModeHeader()
                    : _buildStandardHeader(),
              ),
            ),

            // Expandable Search Row on Home Page
            if (widget.pageType == TopNavBarType.home && widget.isSearchExpanded)
              Padding(
                padding: const EdgeInsets.only(left: 14, right: 14, bottom: 8),
                child: _buildInlineSearchPill(),
              ),
          ],
        ),
      ),
    );
  }

  // ================= STANDARD HEADER (HOME & NOTIFICATIONS) =================
  Widget _buildStandardHeader() {
    final isNotification = widget.pageType == TopNavBarType.notifications;

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        // Left: Back button or Logo / Title
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (widget.showBackButton) ...[
              GestureDetector(
                onTap: () => Navigator.maybePop(context),
                child: const Padding(
                  padding: EdgeInsets.only(right: 10),
                  child: Icon(Icons.arrow_back_ios_new, color: Colors.white, size: 20),
                ),
              ),
            ],
            if (isNotification && widget.title != null) ...[
              Text(
                widget.title!,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.4,
                ),
              ),
            ] else ...[
              GestureDetector(
                onTapDown: (details) => _showFeedSelectorMenu(context, details),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: const [
                    Text(
                      'NewsShare',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.6,
                      ),
                    ),
                    SizedBox(width: 4),
                    Icon(
                      Icons.keyboard_arrow_down,
                      color: Colors.white70,
                      size: 20,
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),

        // Right Action Icons
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Search button on Home / Notifications
            IconButton(
              icon: Icon(
                widget.isSearchExpanded ? Icons.close : Icons.search,
                color: Colors.white,
                size: 24,
              ),
              onPressed: () {
                if (widget.onSearchToggle != null) {
                  widget.onSearchToggle!();
                } else {
                  Navigator.pushReplacement(
                    context,
                    MaterialPageRoute(builder: (_) => const UserListPage()),
                  );
                }
              },
            ),

            // Notification / Heart Icon
            if (widget.showHeart)
              Stack(
                clipBehavior: Clip.none,
                children: [
                  IconButton(
                    icon: Icon(
                      isNotification ? Icons.favorite : Icons.favorite_border,
                      color: isNotification ? const Color(0xFFFF3040) : Colors.white,
                      size: 24,
                    ),
                    onPressed: () {
                      if (!isNotification) {
                        Navigator.pushReplacement(
                          context,
                          MaterialPageRoute(builder: (_) => const NotificationPage()),
                        );
                      }
                    },
                  ),
                  if (_unreadNotifications > 0 && !isNotification)
                    Positioned(
                      right: 8,
                      top: 8,
                      child: Container(
                        padding: const EdgeInsets.all(3),
                        decoration: const BoxDecoration(
                          color: Color(0xFFFF3040),
                          shape: BoxShape.circle,
                        ),
                        constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                        child: Text(
                          _unreadNotifications > 99 ? '99+' : '$_unreadNotifications',
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 9,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ),
                ],
              ),

            // Direct Message / Chat Icon
            if (widget.showMessages)
              IconButton(
                icon: const Icon(
                  Icons.send_outlined,
                  color: Colors.white,
                  size: 22,
                ),
                tooltip: 'Direct Messages',
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const ConversationsListScreen()),
                  );
                },
              ),
          ],
        ),
      ],
    );
  }

  // ================= SEARCH MODE HEADER (EXPLORE / SEARCH PAGE) =================
  Widget _buildSearchModeHeader() {
    return Row(
      children: [
        if (widget.showBackButton)
          GestureDetector(
            onTap: () => Navigator.maybePop(context),
            child: const Padding(
              padding: EdgeInsets.only(right: 10),
              child: Icon(Icons.arrow_back_ios_new, color: Colors.white, size: 20),
            ),
          ),

        // Instagram Search Pill
        Expanded(
          child: _buildInlineSearchPill(),
        ),

        // Filter / Tune button
        if (widget.onFilterTap != null)
          IconButton(
            icon: const Icon(Icons.tune_rounded, color: Colors.white, size: 22),
            tooltip: 'Filter',
            onPressed: widget.onFilterTap,
          ),

        // Heart Icon on Explore as well
        if (widget.showHeart)
          Stack(
            clipBehavior: Clip.none,
            children: [
              IconButton(
                icon: const Icon(Icons.favorite_border, color: Colors.white, size: 23),
                onPressed: () {
                  Navigator.pushReplacement(
                    context,
                    MaterialPageRoute(builder: (_) => const NotificationPage()),
                  );
                },
              ),
              if (_unreadNotifications > 0)
                Positioned(
                  right: 8,
                  top: 8,
                  child: Container(
                    padding: const EdgeInsets.all(3),
                    decoration: const BoxDecoration(
                      color: Color(0xFFFF3040),
                      shape: BoxShape.circle,
                    ),
                    constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                    child: Text(
                      _unreadNotifications > 99 ? '99+' : '$_unreadNotifications',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 9,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
            ],
          ),
      ],
    );
  }

  // ================= INLINE SEARCH PILL =================
  Widget _buildInlineSearchPill() {
    final hasText = widget.searchController?.text.isNotEmpty ?? false;

    return Container(
      height: 38,
      decoration: BoxDecoration(
        color: const Color(0xFF262626),
        borderRadius: BorderRadius.circular(10),
      ),
      child: TextField(
        controller: widget.searchController,
        onChanged: widget.onSearchChanged,
        style: const TextStyle(color: Colors.white, fontSize: 14),
        cursorColor: const Color(0xFF0095F6),
        decoration: InputDecoration(
          isDense: true,
          hintText: 'Search',
          hintStyle: const TextStyle(color: Color(0xFF8E8E93), fontSize: 14),
          prefixIcon: const Icon(Icons.search, color: Color(0xFFA8A8A8), size: 20),
          suffixIcon: hasText
              ? GestureDetector(
                  onTap: () {
                    widget.searchController?.clear();
                    widget.onSearchChanged?.call('');
                    widget.onClearSearch?.call();
                  },
                  child: const Icon(Icons.cancel, color: Color(0xFFA8A8A8), size: 18),
                )
              : null,
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(vertical: 9, horizontal: 8),
        ),
      ),
    );
  }
}

// Backward compatibility alias
typedef TopAppBar = InstagramTopNavBar;
