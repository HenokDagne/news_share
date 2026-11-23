/*
  Instagram-style Followers & Following Screen:
  - Top bar with back button, target username, and discover users icon.
  - Two tabs: "X Followers" and "Y Following" with active indicator line.
  - Search bar to filter users in real time.
  - Real backend data fetched via ApiClient.instance.getFollowers and getFollowing.
  - Follow / Following toggle buttons wired directly to backend API.
  - Tapping a user row navigates to their profile.
*/

import 'package:flutter/material.dart';
import '../../services/api_client.dart';
import '../users/user_list.dart';
import 'profile_page.dart';

class FollowersFollowingPage extends StatefulWidget {
  final String userId;
  final String username;
  final int initialTabIndex; // 0 = Followers, 1 = Following
  final int initialFollowersCount;
  final int initialFollowingCount;

  const FollowersFollowingPage({
    super.key,
    required this.userId,
    required this.username,
    this.initialTabIndex = 0,
    this.initialFollowersCount = 0,
    this.initialFollowingCount = 0,
  });

  @override
  State<FollowersFollowingPage> createState() => _FollowersFollowingPageState();
}

class _FollowersFollowingPageState extends State<FollowersFollowingPage>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final TextEditingController _searchController = TextEditingController();

  List<Map<String, dynamic>> _followersList = [];
  List<Map<String, dynamic>> _followingList = [];

  bool _isLoadingFollowers = true;
  bool _isLoadingFollowing = true;
  String _searchQuery = '';

  // Set of user IDs that the current authenticated user is actively following
  final Set<String> _myFollowingIds = {};
  final Set<String> _pendingActionIds = {};

  String? get _currentUserId => ApiClient.instance.currentUserId;
  bool get _isOwnProfile => _currentUserId != null && _currentUserId == widget.userId;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(
      length: 2,
      vsync: this,
      initialIndex: widget.initialTabIndex.clamp(0, 1),
    );
    _tabController.addListener(() {
      if (mounted) setState(() {});
    });

    _searchController.addListener(() {
      setState(() {
        _searchQuery = _searchController.text.trim().toLowerCase();
      });
    });

    _loadData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    _fetchFollowers();
    _fetchFollowing();
    _fetchMyOwnFollowingStatus();
  }

  Future<void> _fetchFollowers() async {
    setState(() => _isLoadingFollowers = true);
    try {
      final list = await ApiClient.instance.getFollowers(widget.userId);
      if (mounted) {
        setState(() {
          _followersList = list;
          _isLoadingFollowers = false;
        });
      }
    } catch (e) {
      debugPrint('Error fetching followers: $e');
      if (mounted) setState(() => _isLoadingFollowers = false);
    }
  }

  Future<void> _fetchFollowing() async {
    setState(() => _isLoadingFollowing = true);
    try {
      final list = await ApiClient.instance.getFollowing(widget.userId);
      if (mounted) {
        setState(() {
          _followingList = list;
          _isLoadingFollowing = false;
        });
      }
    } catch (e) {
      debugPrint('Error fetching following: $e');
      if (mounted) setState(() => _isLoadingFollowing = false);
    }
  }

  Future<void> _fetchMyOwnFollowingStatus() async {
    if (!ApiClient.instance.isAuthenticated || _currentUserId == null) return;
    try {
      // If on own profile, the following list is already our following list
      if (_isOwnProfile) {
        final list = await ApiClient.instance.getFollowing(_currentUserId!);
        if (mounted) {
          setState(() {
            _myFollowingIds.clear();
            for (final u in list) {
              final id = u['id']?.toString();
              if (id != null) _myFollowingIds.add(id);
            }
          });
        }
      } else {
        final myList = await ApiClient.instance.getFollowing(_currentUserId!);
        if (mounted) {
          setState(() {
            _myFollowingIds.clear();
            for (final u in myList) {
              final id = u['id']?.toString();
              if (id != null) _myFollowingIds.add(id);
            }
          });
        }
      }
    } catch (e) {
      debugPrint('Error fetching my own following status: $e');
    }
  }

  Future<void> _toggleFollow(String targetUserId) async {
    if (!ApiClient.instance.isAuthenticated) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please log in to follow users')),
      );
      return;
    }

    if (_pendingActionIds.contains(targetUserId)) return;

    final isCurrentlyFollowing = _myFollowingIds.contains(targetUserId);

    setState(() {
      _pendingActionIds.add(targetUserId);
      if (isCurrentlyFollowing) {
        _myFollowingIds.remove(targetUserId);
      } else {
        _myFollowingIds.add(targetUserId);
      }
    });

    try {
      if (isCurrentlyFollowing) {
        await ApiClient.instance.unfollow(targetUserId);
      } else {
        await ApiClient.instance.follow(targetUserId);
      }
    } catch (e) {
      // Revert optimistic update
      if (mounted) {
        setState(() {
          if (isCurrentlyFollowing) {
            _myFollowingIds.add(targetUserId);
          } else {
            _myFollowingIds.remove(targetUserId);
          }
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to update follow status: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _pendingActionIds.remove(targetUserId);
        });
      }
    }
  }

  List<Map<String, dynamic>> _filterList(List<Map<String, dynamic>> list) {
    if (_searchQuery.isEmpty) return list;
    return list.where((user) {
      final username = (user['username'] ?? '').toString().toLowerCase();
      final fullName = (user['fullName'] ?? '').toString().toLowerCase();
      return username.contains(_searchQuery) || fullName.contains(_searchQuery);
    }).toList();
  }

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
    final followersCount = _followersList.length > widget.initialFollowersCount
        ? _followersList.length
        : widget.initialFollowersCount;
    final followingCount = _followingList.length > widget.initialFollowingCount
        ? _followingList.length
        : widget.initialFollowingCount;

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white, size: 24),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          widget.username,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 18,
            fontWeight: FontWeight.bold,
            letterSpacing: 0.2,
          ),
        ),
        centerTitle: false,
        actions: [
          IconButton(
            icon: const Icon(Icons.person_add_outlined, color: Colors.white, size: 22),
            tooltip: 'Discover People',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const UserListPage()),
              );
            },
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(48),
          child: Container(
            decoration: const BoxDecoration(
              border: Border(
                bottom: BorderSide(color: Color(0xFF1E222B), width: 1),
              ),
            ),
            child: TabBar(
              controller: _tabController,
              indicatorColor: Colors.white,
              indicatorWeight: 1.8,
              labelColor: Colors.white,
              unselectedLabelColor: Colors.grey.shade600,
              labelStyle: const TextStyle(
                fontSize: 14.5,
                fontWeight: FontWeight.bold,
              ),
              unselectedLabelStyle: const TextStyle(
                fontSize: 14.5,
                fontWeight: FontWeight.w500,
              ),
              tabs: [
                Tab(text: '$followersCount Followers'),
                Tab(text: '$followingCount Following'),
              ],
            ),
          ),
        ),
      ),
      body: Column(
        children: [
          // Search Bar (Instagram style)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Container(
              height: 38,
              decoration: BoxDecoration(
                color: const Color(0xFF262626),
                borderRadius: BorderRadius.circular(10),
              ),
              child: TextField(
                controller: _searchController,
                style: const TextStyle(color: Colors.white, fontSize: 14),
                cursorColor: const Color(0xFF0095F6),
                decoration: InputDecoration(
                  hintText: 'Search',
                  hintStyle: TextStyle(color: Colors.grey.shade500, fontSize: 14),
                  prefixIcon: Icon(Icons.search, color: Colors.grey.shade400, size: 20),
                  suffixIcon: _searchQuery.isNotEmpty
                      ? GestureDetector(
                          onTap: () => _searchController.clear(),
                          child: Icon(Icons.cancel, color: Colors.grey.shade400, size: 18),
                        )
                      : null,
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(vertical: 9),
                ),
              ),
            ),
          ),

          // Tab Views: Followers & Following Lists
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                // 1. Followers List
                _buildUserList(
                  users: _filterList(_followersList),
                  isLoading: _isLoadingFollowers,
                  emptyText: 'No followers yet',
                  onRefresh: _fetchFollowers,
                ),

                // 2. Following List
                _buildUserList(
                  users: _filterList(_followingList),
                  isLoading: _isLoadingFollowing,
                  emptyText: 'Not following anyone yet',
                  onRefresh: _fetchFollowing,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildUserList({
    required List<Map<String, dynamic>> users,
    required bool isLoading,
    required String emptyText,
    required Future<void> Function() onRefresh,
  }) {
    if (isLoading) {
      return const Center(
        child: CircularProgressIndicator(
          strokeWidth: 2,
          color: Color(0xFF0095F6),
        ),
      );
    }

    if (users.isEmpty) {
      return RefreshIndicator(
        onRefresh: onRefresh,
        color: const Color(0xFF0095F6),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            SizedBox(height: MediaQuery.of(context).size.height * 0.2),
            Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white24, width: 2),
                    ),
                    child: const Icon(Icons.group_outlined, color: Colors.white54, size: 40),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    _searchQuery.isNotEmpty ? 'No users matching "$_searchQuery"' : emptyText,
                    style: const TextStyle(
                      color: Colors.white70,
                      fontSize: 15,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: onRefresh,
      color: const Color(0xFF0095F6),
      child: ListView.builder(
        padding: const EdgeInsets.symmetric(vertical: 4),
        itemCount: users.length,
        itemBuilder: (context, index) {
          final user = users[index];
          final userId = user['id']?.toString() ?? '';
          final username = user['username']?.toString() ?? 'user';
          final fullName = user['fullName']?.toString() ?? '';
          final avatarUrl = _resolveAvatarUrl(user['avatarUrl']?.toString());
          final isMe = _currentUserId != null && _currentUserId == userId;
          final isFollowing = _myFollowingIds.contains(userId);
          final isPending = _pendingActionIds.contains(userId);

          return InkWell(
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => ProfilePage(userId: userId)),
              );
            },
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              child: Row(
                children: [
                  // Avatar
                  Container(
                    width: 50,
                    height: 50,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: const Color(0xFF1E222B),
                      border: Border.all(color: Colors.white12, width: 1),
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: avatarUrl != null
                        ? Image.network(
                            avatarUrl,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => _avatarFallback(username),
                          )
                        : _avatarFallback(username),
                  ),
                  const SizedBox(width: 14),

                  // Username and Full Name
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Row(
                          children: [
                            Flexible(
                              child: Text(
                                username,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 14.5,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ],
                        ),
                        if (fullName.isNotEmpty) ...[
                          const SizedBox(height: 2),
                          Text(
                            fullName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: Colors.grey.shade400,
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),

                  // Action Button (Follow / Following)
                  if (!isMe)
                    SizedBox(
                      height: 32,
                      child: isPending
                          ? const Center(
                              child: SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white70,
                                ),
                              ),
                            )
                          : ElevatedButton(
                              onPressed: () => _toggleFollow(userId),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: isFollowing
                                    ? const Color(0xFF262626)
                                    : const Color(0xFF0095F6),
                                foregroundColor: Colors.white,
                                elevation: 0,
                                padding: const EdgeInsets.symmetric(horizontal: 18),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(8),
                                ),
                              ),
                              child: Text(
                                isFollowing ? 'Following' : 'Follow',
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.bold,
                                  color: isFollowing ? Colors.white : Colors.white,
                                ),
                              ),
                            ),
                    ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _avatarFallback(String username) {
    return Center(
      child: Text(
        username.isNotEmpty ? username[0].toUpperCase() : 'U',
        style: const TextStyle(
          color: Colors.white,
          fontSize: 18,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}
