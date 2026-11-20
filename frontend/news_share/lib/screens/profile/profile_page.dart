/*
  ProfilePage displays user profile details, follow stats, action buttons (Edit or Follow/Unfollow),
  and published posts. Works for both current authenticated user and external publishers.
*/

import 'package:flutter/material.dart';
import '../../services/api_client.dart';
import '../home/top_app_bar.dart';
import '../home/bottom_nav.dart';
import '../home/home_page.dart';
import '../post/post_page.dart';
import '../notification/notification_page.dart';
import 'profile_edit_screen.dart';
import '../users/user_list.dart';
import 'follow_stats_box.dart';
import '../auth/login.dart';

class ProfilePage extends StatefulWidget {
  final String? userId;

  const ProfilePage({super.key, this.userId});

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  int _currentIndex = 4;
  bool _isLoading = true;
  Map<String, dynamic>? _targetProfile;
  CurrentUserModel? _myProfile;
  bool _isFollowing = false;
  bool _isFollowingLoading = false;
  List<Map<String, dynamic>> _userPosts = [];
  bool _isLoadingPosts = true;

  bool get _isOwnProfile {
    final myId = ApiClient.instance.currentUserId;
    return widget.userId == null || (myId != null && myId == widget.userId);
  }

  @override
  void initState() {
    super.initState();
    _loadProfileData();
  }

  Future<void> _loadProfileData() async {
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
        final myId = ApiClient.instance.currentUserId;
        List<Map<String, dynamic>> posts = [];
        if (myId != null) {
          try {
            posts = await ApiClient.instance.getUserPosts(myId);
          } catch (_) {}
        }
        if (mounted) {
          setState(() {
            _myProfile = me;
            _userPosts = posts;
            _isLoading = false;
            _isLoadingPosts = false;
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

        if (mounted) {
          setState(() {
            _targetProfile = profile;
            _isFollowing = following;
            _userPosts = posts;
            _isLoading = false;
            _isLoadingPosts = false;
          });
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _isLoadingPosts = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load profile: $e')),
        );
      }
    }
  }

  Future<void> _toggleFollow() async {
    if (!ApiClient.instance.isAuthenticated) {
      Navigator.push(context, MaterialPageRoute(builder: (_) => const LoginPage()));
      return;
    }

    final targetId = widget.userId;
    if (targetId == null) return;

    final next = !_isFollowing;
    setState(() {
      _isFollowing = next;
      _isFollowingLoading = true;
    });

    try {
      if (next) {
        await ApiClient.instance.follow(targetId);
      } else {
        await ApiClient.instance.unfollow(targetId);
      }
      if (mounted) {
        setState(() => _isFollowingLoading = false);
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isFollowing = !next;
          _isFollowingLoading = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Follow update failed: $e')),
        );
      }
    }
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
      Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => const LoginPage()),
      );
      return;
    }

    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const ProfileEditScreen()),
    ).then((_) => _loadProfileData());
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        backgroundColor: Colors.white,
        body: Center(child: CircularProgressIndicator()),
      );
    }

    if (_isOwnProfile && !ApiClient.instance.isAuthenticated) {
      return Scaffold(
        backgroundColor: Colors.grey[100],
        appBar: const PreferredSize(
          preferredSize: Size.fromHeight(70),
          child: TopAppBar(),
        ),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.person_outline, size: 72, color: Colors.grey),
                const SizedBox(height: 16),
                const Text(
                  'Guest Profile',
                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Sign in to edit your profile, interact with news, and build your follower network.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.grey),
                ),
                const SizedBox(height: 20),
                ElevatedButton(
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const LoginPage()),
                    );
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF2563EB),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 12),
                  ),
                  child: const Text('Sign In'),
                ),
              ],
            ),
          ),
        ),
        bottomNavigationBar: BottomNavBar(
          currentIndex: _currentIndex,
          onChanged: _onNavTap,
        ),
      );
    }

    final String displayName;
    final String username;
    final String? bio;
    final String? avatarUrl;
    final String profileUserId;

    if (_isOwnProfile) {
      final me = _myProfile ?? ApiClient.instance.currentUser;
      displayName = (me?.fullName != null && me!.fullName!.isNotEmpty)
          ? me.fullName!
          : (me?.username ?? 'User');
      username = me?.username ?? 'user';
      bio = me?.bio;
      avatarUrl = me?.avatarUrl;
      profileUserId = me?.id ?? '';
    } else {
      final p = _targetProfile ?? {};
      username = p['username']?.toString() ?? 'user';
      displayName = (p['fullName']?.toString() ?? username);
      bio = p['bio']?.toString();
      avatarUrl = p['avatarUrl']?.toString();
      profileUserId = widget.userId!;
    }

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: !_isOwnProfile
            ? IconButton(
                icon: const Icon(Icons.arrow_back, color: Colors.black87),
                onPressed: () => Navigator.pop(context),
              )
            : null,
        title: Text(
          '@$username',
          style: const TextStyle(
            color: Colors.black,
            fontSize: 17,
            fontWeight: FontWeight.bold,
          ),
        ),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        child: Column(
          children: [
            const SizedBox(height: 12),
            // Avatar
            Center(
              child: Container(
                padding: const EdgeInsets.all(3),
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(
                    colors: [Color(0xFFFE2C55), Color(0xFF00F2FE)],
                  ),
                ),
                child: CircleAvatar(
                  radius: 48,
                  backgroundColor: Colors.grey.shade100,
                  backgroundImage: (avatarUrl != null && avatarUrl.startsWith('http'))
                      ? NetworkImage(avatarUrl)
                      : null,
                  child: (avatarUrl == null || !avatarUrl.startsWith('http'))
                      ? Text(
                          displayName.isNotEmpty ? displayName[0].toUpperCase() : 'U',
                          style: const TextStyle(
                            fontSize: 32,
                            fontWeight: FontWeight.bold,
                            color: Colors.black87,
                          ),
                        )
                      : null,
                ),
              ),
            ),
            const SizedBox(height: 10),

            // Display Name
            Text(
              displayName,
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: Colors.black,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              '@$username',
              style: TextStyle(fontSize: 14, color: Colors.grey.shade600),
            ),
            if (bio != null && bio.isNotEmpty) ...[
              const SizedBox(height: 8),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 32),
                child: Text(
                  bio,
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 14, color: Colors.black87),
                ),
              ),
            ],
            const SizedBox(height: 16),

            // Follower stats
            if (profileUserId.isNotEmpty)
              FollowStatsBox(userId: profileUserId),
            const SizedBox(height: 16),

            // Action Button: Edit Profile (Own) or Follow / Following (Other)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: _isOwnProfile
                  ? SizedBox(
                      width: double.infinity,
                      height: 42,
                      child: OutlinedButton(
                        onPressed: _editProfile,
                        style: OutlinedButton.styleFrom(
                          side: BorderSide(color: Colors.grey.shade300),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                        child: const Text(
                          'Edit Profile',
                          style: TextStyle(fontWeight: FontWeight.bold, color: Colors.black87),
                        ),
                      ),
                    )
                  : SizedBox(
                      width: double.infinity,
                      height: 42,
                      child: ElevatedButton(
                        onPressed: _isFollowingLoading ? null : _toggleFollow,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: _isFollowing
                              ? Colors.grey.shade200
                              : const Color(0xFFFE2C55),
                          foregroundColor: _isFollowing ? Colors.black87 : Colors.white,
                          elevation: 0,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                        child: _isFollowingLoading
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            : Text(
                                _isFollowing ? 'Following' : 'Follow',
                                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                              ),
                      ),
                    ),
            ),
            const SizedBox(height: 20),
            Divider(height: 1, color: Colors.grey.shade200),

            // Published Posts Section Header
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(
                children: [
                  const Icon(Icons.grid_on, size: 18, color: Colors.black87),
                  const SizedBox(width: 8),
                  Text(
                    'Published Posts (${_userPosts.length})',
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: Colors.black87,
                    ),
                  ),
                ],
              ),
            ),

            // User Posts Grid / List
            if (_isLoadingPosts)
              const Padding(
                padding: EdgeInsets.all(24),
                child: CircularProgressIndicator(),
              )
            else if (_userPosts.isEmpty)
              Padding(
                padding: const EdgeInsets.all(32),
                child: Column(
                  children: [
                    Icon(Icons.post_add, size: 48, color: Colors.grey.shade300),
                    const SizedBox(height: 8),
                    Text(
                      'No posts published yet',
                      style: TextStyle(color: Colors.grey.shade500, fontSize: 14),
                    ),
                  ],
                ),
              )
            else
              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                itemCount: _userPosts.length,
                separatorBuilder: (_, __) => const SizedBox(height: 12),
                itemBuilder: (context, index) {
                  final post = _userPosts[index];
                  final title = post['title']?.toString() ?? 'News Update';
                  final content = post['content']?.toString() ?? '';
                  final imageUrl = post['imageUrl']?.toString();

                  return Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade50,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.grey.shade200),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (imageUrl != null && imageUrl.isNotEmpty) ...[
                          ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: Image.network(
                              imageUrl,
                              width: 60,
                              height: 60,
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) => Container(
                                width: 60,
                                height: 60,
                                color: Colors.grey.shade200,
                                child: const Icon(Icons.broken_image, size: 24, color: Colors.grey),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                        ],
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                title,
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 14.5,
                                ),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                              if (content.isNotEmpty) ...[
                                const SizedBox(height: 4),
                                Text(
                                  content,
                                  style: TextStyle(fontSize: 12.5, color: Colors.grey.shade600),
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ],
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            const SizedBox(height: 40),
          ],
        ),
      ),
      bottomNavigationBar: _isOwnProfile
          ? BottomNavBar(
              currentIndex: _currentIndex,
              onChanged: _onNavTap,
            )
          : null,
    );
  }
}
