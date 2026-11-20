/*
  Instagram Dark-Mode UI/UX Profile Screen:
  - Top Bar with username dropdown, create post, direct message, and menu actions.
  - Profile Header with circular avatar and 3 stats (posts, followers, following).
  - Add name & Add bio actions with edit links.
  - Primary Action buttons: Edit profile (royal blue), Share profile, and Contact discover.
  - Discover people horizontal carousel with suggested users and live Follow actions.
  - Highlights horizontal story circles with New story button.
  - 3 Content Tabs: Posts Grid, Reels, and Saved/Tagged.
  - 3-Column Square Posts Grid with image previews.
  - Dark-theme bottom navigation bar.
*/

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../services/api_client.dart';
import '../home/bottom_nav.dart';
import '../home/home_page.dart';
import '../post/post_page.dart';
import '../notification/notification_page.dart';
import 'profile_edit_screen.dart';
import '../users/user_list.dart';
import '../auth/login.dart';

class ProfilePage extends StatefulWidget {
  final String? userId;

  const ProfilePage({super.key, this.userId});

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  int _currentIndex = 4;
  int _selectedTabIndex = 0; // 0 = Grid, 1 = Reels, 2 = Saved
  bool _isLoading = true;
  bool _isDiscoverVisible = true;
  bool _isHighlightsExpanded = true;

  CurrentUserModel? _myProfile;
  Map<String, dynamic>? _targetProfile;
  List<Map<String, dynamic>> _userPosts = [];
  List<Map<String, dynamic>> _suggestedUsers = [];

  bool _isFollowing = false;
  bool _isFollowingLoading = false;
  int _followersCount = 0;
  int _followingCount = 0;

  bool get _isOwnProfile {
    final myId = ApiClient.instance.currentUserId;
    return widget.userId == null || (myId != null && myId == widget.userId);
  }

  @override
  void initState() {
    super.initState();
    _loadAllProfileData();
  }

  Future<void> _loadAllProfileData() async {
    setState(() => _isLoading = true);
    try {
      if (_isOwnProfile) {
        if (!ApiClient.instance.isAuthenticated) {
          setState(() {
            _myProfile = null;
            _isLoading = false;
          });
          return;
        }

        final me = await ApiClient.instance.getMe();
        final myId = ApiClient.instance.currentUserId ?? '';

        // Load posts, saved posts, and suggested users in parallel
        final results = await Future.wait([
          ApiClient.instance.getUserPosts(myId).catchError((_) => <Map<String, dynamic>>[]),
          ApiClient.instance.getUsers(limit: 10).catchError((_) => <Map<String, dynamic>>[]),
          ApiClient.instance.getFollowStatus(myId).catchError((_) => <String, bool>{}),
        ]);

        final posts = results[0] as List<Map<String, dynamic>>;
        final users = results[1] as List<Map<String, dynamic>>;

        // Also fetch follow stats for exact counts
        int followers = 0;
        int following = 0;
        try {
          final profileData = await ApiClient.instance.getUserProfile(myId);
          followers = (profileData['followersCount'] ?? profileData['followers_count'] ?? 0) as int;
          following = (profileData['followingCount'] ?? profileData['following_count'] ?? 0) as int;
        } catch (_) {}

        if (mounted) {
          setState(() {
            _myProfile = me;
            _userPosts = posts;
            _suggestedUsers = users.where((u) => u['id'] != myId).toList();
            _followersCount = followers;
            _followingCount = following;
            _isLoading = false;
          });
        }
      } else {
        final profile = await ApiClient.instance.getUserProfile(widget.userId!);

        bool following = false;
        if (ApiClient.instance.isAuthenticated) {
          try {
            final status = await ApiClient.instance.getFollowStatus(widget.userId!);
            following = status['isFollowing'] == true;
          } catch (_) {}
        }

        List<Map<String, dynamic>> posts = [];
        try {
          posts = await ApiClient.instance.getUserPosts(widget.userId!);
        } catch (_) {}

        int followers = (profile['followersCount'] ?? profile['followers_count'] ?? 0) as int;
        int followingCount = (profile['followingCount'] ?? profile['following_count'] ?? 0) as int;

        if (mounted) {
          setState(() {
            _targetProfile = profile;
            _userPosts = posts;
            _isFollowing = following;
            _followersCount = followers;
            _followingCount = followingCount;
            _isLoading = false;
          });
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load profile: $e')),
        );
      }
    }
  }

  Future<void> _toggleFollowTarget() async {
    if (!ApiClient.instance.isAuthenticated) {
      Navigator.push(context, MaterialPageRoute(builder: (_) => const LoginPage()));
      return;
    }

    final targetId = widget.userId;
    if (targetId == null) return;

    final next = !_isFollowing;
    setState(() {
      _isFollowing = next;
      _followersCount += next ? 1 : -1;
      _isFollowingLoading = true;
    });

    try {
      if (next) {
        await ApiClient.instance.follow(targetId);
      } else {
        await ApiClient.instance.unfollow(targetId);
      }
      if (mounted) setState(() => _isFollowingLoading = false);
    } catch (e) {
      if (mounted) {
        setState(() {
          _isFollowing = !next;
          _followersCount += !next ? 1 : -1;
          _isFollowingLoading = false;
        });
      }
    }
  }

  Future<void> _followSuggestedUser(Map<String, dynamic> user) async {
    final uid = user['id']?.toString();
    if (uid == null) return;

    setState(() {
      user['isFollowing'] = !(user['isFollowing'] == true);
    });

    try {
      if (user['isFollowing'] == true) {
        await ApiClient.instance.follow(uid);
      } else {
        await ApiClient.instance.unfollow(uid);
      }
    } catch (_) {
      setState(() {
        user['isFollowing'] = !(user['isFollowing'] == true);
      });
    }
  }

  void _shareProfileLink(String username) {
    final link = 'https://newsshare.app/@$username';
    Clipboard.setData(ClipboardData(text: link));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Profile link copied to clipboard!'),
        behavior: SnackBarBehavior.floating,
        duration: Duration(seconds: 2),
      ),
    );
  }

  void _onNavTap(int index) {
    if (index == _currentIndex) return;

    switch (index) {
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
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => const NotificationPage()),
        );
        break;
      default:
        setState(() => _currentIndex = index);
    }
  }

  void _editProfile() {
    if (!ApiClient.instance.isAuthenticated) {
      Navigator.push(context, MaterialPageRoute(builder: (_) => const LoginPage()));
      return;
    }

    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const ProfileEditScreen()),
    ).then((_) => _loadAllProfileData());
  }

  void _showMenuOptions() {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF161920),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 10),
            Container(
              height: 4,
              width: 36,
              decoration: BoxDecoration(
                color: Colors.white24,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 16),
            ListTile(
              leading: const Icon(Icons.settings_outlined, color: Colors.white),
              title: const Text('Settings and privacy', style: TextStyle(color: Colors.white)),
              onTap: () {
                Navigator.pop(context);
                _editProfile();
              },
            ),
            ListTile(
              leading: const Icon(Icons.qr_code_scanner, color: Colors.white),
              title: const Text('QR code', style: TextStyle(color: Colors.white)),
              onTap: () => Navigator.pop(context),
            ),
            ListTile(
              leading: const Icon(Icons.bookmark_outline, color: Colors.white),
              title: const Text('Saved posts', style: TextStyle(color: Colors.white)),
              onTap: () {
                Navigator.pop(context);
                setState(() => _selectedTabIndex = 2);
              },
            ),
            ListTile(
              leading: const Icon(Icons.logout, color: Color(0xFFFE2C55)),
              title: const Text('Log out', style: TextStyle(color: Color(0xFFFE2C55))),
              onTap: () async {
                Navigator.pop(context);
                await ApiClient.instance.logout();
                if (mounted) {
                  Navigator.pushReplacement(
                    context,
                    MaterialPageRoute(builder: (_) => const LoginPage()),
                  );
                }
              },
            ),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        backgroundColor: Colors.black,
        body: Center(
          child: CircularProgressIndicator(color: Colors.white70),
        ),
      );
    }

    if (_isOwnProfile && !ApiClient.instance.isAuthenticated) {
      return Scaffold(
        backgroundColor: Colors.black,
        appBar: AppBar(
          backgroundColor: Colors.black,
          elevation: 0,
          title: const Text('Profile', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        ),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(28),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.person_outline, size: 72, color: Colors.white38),
                const SizedBox(height: 16),
                const Text(
                  'Welcome to NewsShare',
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.white),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Sign in to customize your profile, follow your favorite reporters, and share breaking news.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.white60, fontSize: 13.5),
                ),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: () {
                    Navigator.push(context, MaterialPageRoute(builder: (_) => const LoginPage()));
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF3B82F6),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 40, vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  child: const Text('Log In', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ],
            ),
          ),
        ),
        bottomNavigationBar: BottomNavBar(
          currentIndex: _currentIndex,
          onChanged: _onNavTap,
          isDark: true,
        ),
      );
    }

    final String username;
    final String? fullName;
    final String? bio;
    final String? avatarUrl;

    if (_isOwnProfile) {
      final me = _myProfile ?? ApiClient.instance.currentUser;
      username = me?.username ?? 'enoch.nova';
      fullName = me?.fullName;
      bio = me?.bio;
      avatarUrl = me?.avatarUrl;
    } else {
      final p = _targetProfile ?? {};
      username = p['username']?.toString() ?? 'user';
      fullName = p['fullName']?.toString();
      bio = p['bio']?.toString();
      avatarUrl = p['avatarUrl']?.toString();
    }

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(52),
        child: AppBar(
          backgroundColor: Colors.black,
          elevation: 0,
          leading: !_isOwnProfile
              ? IconButton(
                  icon: const Icon(Icons.arrow_back, color: Colors.white),
                  onPressed: () => Navigator.pop(context),
                )
              : null,
          title: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                username,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  letterSpacing: -0.5,
                ),
              ),
              if (_isOwnProfile) ...[
                const SizedBox(width: 4),
                const Icon(Icons.keyboard_arrow_down, color: Colors.white, size: 20),
              ],
            ],
          ),
          centerTitle: false,
          actions: [
            if (_isOwnProfile) ...[
              // Create [+] Icon
              IconButton(
                icon: const Icon(Icons.add_box_outlined, color: Colors.white, size: 25),
                onPressed: () {
                  Navigator.push(context, MaterialPageRoute(builder: (_) => const PostPage()));
                },
              ),
              // Direct message paper airplane icon
              IconButton(
                icon: const Icon(Icons.near_me_outlined, color: Colors.white, size: 25),
                onPressed: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Direct messages coming soon!')),
                  );
                },
              ),
              // Menu 3 bars icon
              IconButton(
                icon: const Icon(Icons.menu, color: Colors.white, size: 27),
                onPressed: _showMenuOptions,
              ),
            ] else ...[
              IconButton(
                icon: const Icon(Icons.more_horiz, color: Colors.white, size: 25),
                onPressed: () => _showMenuOptions(),
              ),
            ],
          ],
        ),
      ),
      body: RefreshIndicator(
        onRefresh: _loadAllProfileData,
        color: Colors.white,
        backgroundColor: const Color(0xFF161920),
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 8),

              // ===================== 1. AVATAR + 3 STATS ROW =====================
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Row(
                  children: [
                    // Profile Avatar with Camera Icon / Picture
                    _buildAvatar(avatarUrl),
                    const SizedBox(width: 24),

                    // 3 Stats: Posts, Followers, Following
                    Expanded(
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceAround,
                        children: [
                          _buildStatColumn('${_userPosts.length}', 'posts'),
                          _buildStatColumn('$_followersCount', 'followers'),
                          _buildStatColumn('$_followingCount', 'following'),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              // ===================== 2. NAME & BIO (ADD NAME / ADD BIO) =====================
              Padding(
                padding: const EdgeInsets.only(left: 16, right: 16, top: 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (fullName != null && fullName.isNotEmpty) ...[
                      Text(
                        fullName,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 14.5,
                        ),
                      ),
                    ] else if (_isOwnProfile) ...[
                      GestureDetector(
                        onTap: _editProfile,
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: const [
                            Icon(Icons.edit_outlined, size: 14, color: Color(0xFF818CF8)),
                            SizedBox(width: 4),
                            Text(
                              'Add name',
                              style: TextStyle(
                                color: Color(0xFF818CF8),
                                fontSize: 13,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],

                    const SizedBox(height: 4),

                    if (bio != null && bio.isNotEmpty) ...[
                      Text(
                        bio,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 13.5,
                          height: 1.3,
                        ),
                      ),
                    ] else if (_isOwnProfile) ...[
                      GestureDetector(
                        onTap: _editProfile,
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: const [
                            Icon(Icons.edit_outlined, size: 14, color: Color(0xFF818CF8)),
                            SizedBox(width: 4),
                            Text(
                              'Add bio',
                              style: TextStyle(
                                color: Color(0xFF818CF8),
                                fontSize: 13,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),

              const SizedBox(height: 16),

              // ===================== 3. ACTION BUTTONS ROW =====================
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: _isOwnProfile
                    ? Row(
                        children: [
                          // Edit profile (Royal Blue Button)
                          Expanded(
                            child: SizedBox(
                              height: 36,
                              child: ElevatedButton(
                                onPressed: _editProfile,
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF4F46E5),
                                  foregroundColor: Colors.white,
                                  elevation: 0,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  padding: EdgeInsets.zero,
                                ),
                                child: const Text(
                                  'Edit profile',
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),

                          // Share profile (Dark Card Button)
                          Expanded(
                            child: SizedBox(
                              height: 36,
                              child: ElevatedButton(
                                onPressed: () => _shareProfileLink(username),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF1E222B),
                                  foregroundColor: Colors.white,
                                  elevation: 0,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  padding: EdgeInsets.zero,
                                ),
                                child: const Text(
                                  'Share profile',
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),

                          // Discover contact square button
                          Container(
                            height: 36,
                            width: 36,
                            decoration: BoxDecoration(
                              color: const Color(0xFF1E222B),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: IconButton(
                              icon: const Icon(Icons.person_add_outlined, color: Colors.white, size: 18),
                              padding: EdgeInsets.zero,
                              onPressed: () {
                                setState(() => _isDiscoverVisible = !_isDiscoverVisible);
                              },
                            ),
                          ),
                        ],
                      )
                    : Row(
                        children: [
                          // Follow / Following Button
                          Expanded(
                            child: SizedBox(
                              height: 36,
                              child: ElevatedButton(
                                onPressed: _isFollowingLoading ? null : _toggleFollowTarget,
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: _isFollowing
                                      ? const Color(0xFF1E222B)
                                      : const Color(0xFF4F46E5),
                                  foregroundColor: Colors.white,
                                  elevation: 0,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                ),
                                child: _isFollowingLoading
                                    ? const SizedBox(
                                        width: 16,
                                        height: 16,
                                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                      )
                                    : Text(
                                        _isFollowing ? 'Following' : 'Follow',
                                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                                      ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          // Message Button
                          Expanded(
                            child: SizedBox(
                              height: 36,
                              child: ElevatedButton(
                                onPressed: () {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(content: Text('Direct message with @$username opening...')),
                                  );
                                },
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF1E222B),
                                  foregroundColor: Colors.white,
                                  elevation: 0,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                ),
                                child: const Text(
                                  'Message',
                                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
              ),

              // ===================== 4. DISCOVER PEOPLE SECTION =====================
              if (_isOwnProfile && _isDiscoverVisible && _suggestedUsers.isNotEmpty) ...[
                const SizedBox(height: 16),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Discover people',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 14.5,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      GestureDetector(
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => const UserListPage()),
                          );
                        },
                        child: const Text(
                          'See all',
                          style: TextStyle(
                            color: Color(0xFF3B82F6),
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 10),

                // Horizontal Carousel of suggested users matching Screenshot
                SizedBox(
                  height: 185,
                  child: ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    scrollDirection: Axis.horizontal,
                    itemCount: _suggestedUsers.length,
                    separatorBuilder: (context, index) => const SizedBox(width: 10),
                    itemBuilder: (context, index) {
                      final u = _suggestedUsers[index];
                      return _buildDiscoverCard(u);
                    },
                  ),
                ),
              ],

              // ===================== 5. HIGHLIGHTS SECTION =====================
              const SizedBox(height: 14),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: const [
                        Text(
                          'Highlights',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        SizedBox(height: 2),
                        Text(
                          'Keep your favorite stories on your profile.',
                          style: TextStyle(
                            color: Colors.white60,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                    IconButton(
                      icon: Icon(
                        _isHighlightsExpanded ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                        color: Colors.white70,
                        size: 20,
                      ),
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                      onPressed: () {
                        setState(() => _isHighlightsExpanded = !_isHighlightsExpanded);
                      },
                    ),
                  ],
                ),
              ),

              if (_isHighlightsExpanded) ...[
                const SizedBox(height: 12),
                SizedBox(
                  height: 84,
                  child: ListView(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    scrollDirection: Axis.horizontal,
                    children: [
                      // "New" circle button with [+]
                      Column(
                        children: [
                          Container(
                            width: 60,
                            height: 60,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              border: Border.all(color: Colors.white24, width: 1.2),
                              color: const Color(0xFF14171E),
                            ),
                            child: const Icon(Icons.add, color: Colors.white, size: 26),
                          ),
                          const SizedBox(height: 6),
                          const Text(
                            'New',
                            style: TextStyle(color: Colors.white, fontSize: 12),
                          ),
                        ],
                      ),
                      const SizedBox(width: 16),

                      // Placeholder story circles matching screenshot
                      _buildHighlightCircle('News'),
                      const SizedBox(width: 16),
                      _buildHighlightCircle('Events'),
                      const SizedBox(width: 16),
                      _buildHighlightCircle('Updates'),
                    ],
                  ),
                ),
              ],

              const SizedBox(height: 14),

              // ===================== 6. 3 TABS (GRID, REELS, TAGGED/SAVED) =====================
              Container(
                decoration: const BoxDecoration(
                  border: Border(
                    top: BorderSide(color: Color(0xFF1E222B), width: 1),
                  ),
                ),
                child: Row(
                  children: [
                    _buildTabItem(icon: Icons.grid_on_sharp, index: 0),
                    _buildTabItem(icon: Icons.sync_alt_rounded, index: 1),
                    _buildTabItem(icon: Icons.person_pin_outlined, index: 2),
                  ],
                ),
              ),

              // ===================== 7. 3-COLUMN SQUARE POSTS GRID =====================
              if (_userPosts.isEmpty)
                Container(
                  padding: const EdgeInsets.symmetric(vertical: 48),
                  alignment: Alignment.center,
                  child: Column(
                    children: [
                      Container(
                        width: 68,
                        height: 68,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white24, width: 2),
                        ),
                        child: const Icon(Icons.camera_alt_outlined, color: Colors.white54, size: 34),
                      ),
                      const SizedBox(height: 16),
                      const Text(
                        'Share Photos and Videos',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 6),
                      const Text(
                        'When you share news or updates, they appear on your profile.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: Colors.white60, fontSize: 13),
                      ),
                      if (_isOwnProfile) ...[
                        const SizedBox(height: 16),
                        TextButton(
                          onPressed: () {
                            Navigator.push(context, MaterialPageRoute(builder: (_) => const PostPage()));
                          },
                          child: const Text(
                            'Share your first post',
                            style: TextStyle(
                              color: Color(0xFF3B82F6),
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                )
              else
                GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: _userPosts.length,
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 3,
                    crossAxisSpacing: 2,
                    mainAxisSpacing: 2,
                    childAspectRatio: 1.0,
                  ),
                  itemBuilder: (context, index) {
                    final post = _userPosts[index];
                    final imageUrl = post['imageUrl']?.toString();
                    final title = post['title']?.toString() ?? 'News';

                    return Container(
                      color: const Color(0xFF14171E),
                      child: (imageUrl != null && imageUrl.startsWith('http'))
                          ? Image.network(
                              imageUrl,
                              fit: BoxFit.cover,
                              errorBuilder: (context, error, stackTrace) => _buildPostTilePlaceholder(title),
                            )
                          : _buildPostTilePlaceholder(title),
                    );
                  },
                ),

              const SizedBox(height: 30),
            ],
          ),
        ),
      ),
      bottomNavigationBar: BottomNavBar(
        currentIndex: _currentIndex,
        onChanged: _onNavTap,
        isDark: true,
      ),
    );
  }

  // ----------------- WIDGET BUILDERS -----------------

  Widget _buildAvatar(String? avatarUrl) {
    return Stack(
      children: [
        Container(
          width: 86,
          height: 86,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: const Color(0xFF1E222B),
            border: Border.all(color: Colors.white12, width: 1.5),
          ),
          clipBehavior: Clip.antiAlias,
          child: (avatarUrl != null && avatarUrl.startsWith('http'))
              ? Image.network(
                  avatarUrl,
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) => const Center(
                    child: Icon(Icons.camera_alt_outlined, size: 32, color: Color(0xFF818CF8)),
                  ),
                )
              : const Center(
                  child: Icon(Icons.camera_alt_outlined, size: 32, color: Color(0xFF818CF8)),
                ),
        ),
        if (_isOwnProfile)
          Positioned(
            bottom: 0,
            right: 0,
            child: GestureDetector(
              onTap: _editProfile,
              child: Container(
                width: 24,
                height: 24,
                decoration: BoxDecoration(
                  color: const Color(0xFF4F46E5),
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.black, width: 2),
                ),
                child: const Icon(Icons.add, color: Colors.white, size: 16),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildStatColumn(String count, String label) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          count,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 3),
        Text(
          label,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 13,
            fontWeight: FontWeight.w400,
          ),
        ),
      ],
    );
  }

  Widget _buildDiscoverCard(Map<String, dynamic> user) {
    final username = user['username']?.toString() ?? 'user';
    final fullName = user['fullName']?.toString() ?? username;
    final avatarUrl = user['avatarUrl']?.toString();
    final isFollowing = user['isFollowing'] == true;

    return Container(
      width: 148,
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: const Color(0xFF161920),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white10),
      ),
      child: Stack(
        children: [
          // Close button in top right
          Positioned(
            top: 0,
            right: 0,
            child: GestureDetector(
              onTap: () {
                setState(() => _suggestedUsers.remove(user));
              },
              child: const Icon(Icons.close, color: Colors.white38, size: 16),
            ),
          ),

          Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Avatar
              CircleAvatar(
                radius: 28,
                backgroundColor: const Color(0xFF262A34),
                backgroundImage: (avatarUrl != null && avatarUrl.startsWith('http'))
                    ? NetworkImage(avatarUrl)
                    : null,
                child: (avatarUrl == null || !avatarUrl.startsWith('http'))
                    ? Text(
                        username.isNotEmpty ? username[0].toUpperCase() : 'U',
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 18,
                        ),
                      )
                    : null,
              ),
              const SizedBox(height: 8),

              // Username
              Text(
                username,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                ),
              ),

              // Subtitle
              Text(
                fullName.isNotEmpty ? fullName : 'Suggested for you',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Colors.white38,
                  fontSize: 11,
                ),
              ),
              const SizedBox(height: 10),

              // Follow button
              SizedBox(
                width: double.infinity,
                height: 28,
                child: ElevatedButton(
                  onPressed: () => _followSuggestedUser(user),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: isFollowing ? const Color(0xFF262A34) : const Color(0xFF4F46E5),
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                    padding: EdgeInsets.zero,
                  ),
                  child: Text(
                    isFollowing ? 'Following' : 'Follow',
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildHighlightCircle(String label) {
    return Column(
      children: [
        Container(
          width: 60,
          height: 60,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: const Color(0xFF1A1D24),
            border: Border.all(color: Colors.white12, width: 1.2),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          label,
          style: const TextStyle(color: Colors.white70, fontSize: 12),
        ),
      ],
    );
  }

  Widget _buildTabItem({required IconData icon, required int index}) {
    final isSelected = _selectedTabIndex == index;

    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _selectedTabIndex = index),
        child: Container(
          height: 44,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(
                color: isSelected ? Colors.white : Colors.transparent,
                width: 1.8,
              ),
            ),
          ),
          child: Icon(
            icon,
            size: 24,
            color: isSelected ? Colors.white : Colors.white38,
          ),
        ),
      ),
    );
  }

  Widget _buildPostTilePlaceholder(String title) {
    return Container(
      padding: const EdgeInsets.all(8),
      alignment: Alignment.center,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF1E222B), Color(0xFF14171E)],
        ),
      ),
      child: Text(
        title,
        maxLines: 3,
        overflow: TextOverflow.ellipsis,
        textAlign: TextAlign.center,
        style: const TextStyle(
          color: Colors.white70,
          fontSize: 11,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
