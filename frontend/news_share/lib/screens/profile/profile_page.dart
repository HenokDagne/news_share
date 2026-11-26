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
import 'dart:io';
import 'package:image_picker/image_picker.dart';
import '../../services/camera/camera_service.dart';
import '../../services/camera/camera_service_locator.dart';
import '../../services/api_client.dart';
import '../home/bottom_nav.dart';
import '../home/home_page.dart';
import '../post/post_page.dart';
import '../notification/notification_page.dart';
import '../moderation/post_actions_sheet.dart';
import 'followers_following_page.dart';
import '../privacy/privacy_and_safety_screen.dart';
import '../activity/activity_page.dart';
import '../settings/settings_page.dart';
import '../users/user_list.dart';
import '../auth/login.dart';

class ProfilePage extends StatefulWidget {
  final String? userId;

  const ProfilePage({super.key, this.userId});

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  int _currentIndex = 4;
  int _selectedTabIndex = 0; // 0 = Grid, 1 = Reels, 2 = Saved
  bool _isLoading = true;
  bool _isDiscoverVisible = true;
  bool _isHighlightsExpanded = true;

  CurrentUserModel? _myProfile;
  Map<String, dynamic>? _targetProfile;
  List<Map<String, dynamic>> _userPosts = [];
  List<Map<String, dynamic>> _savedPosts = [];
  List<Map<String, dynamic>> _suggestedUsers = [];

  bool _isFollowing = false;
  bool _isFollowingLoading = false;
  int _followersCount = 0;
  int _followingCount = 0;
  int _postsCount = 0;

  bool get _isOwnProfile {
    final myId = ApiClient.instance.currentUserId;
    return widget.userId == null || (myId != null && myId == widget.userId);
  }

  List<Map<String, dynamic>> get _currentTabPosts {
    if (_selectedTabIndex == 0) {
      return _userPosts;
    } else if (_selectedTabIndex == 1) {
      return _userPosts.where((p) {
        final img = p['imageUrl']?.toString() ?? p['image_url']?.toString();
        return img != null && img.trim().isNotEmpty;
      }).toList();
    } else {
      return _savedPosts.isNotEmpty ? _savedPosts : _userPosts;
    }
  }

  @override
  void initState() {
    super.initState();
    initCameraService();
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
          ApiClient.instance.getSavedPosts().catchError((_) => <Map<String, dynamic>>[]),
        ]);

        final posts = results[0] as List<Map<String, dynamic>>;
        final users = results[1] as List<Map<String, dynamic>>;
        final saved = results[2] as List<Map<String, dynamic>>;

        if (mounted) {
          setState(() {
            _myProfile = me;
            _userPosts = posts;
            _savedPosts = saved;
            _suggestedUsers = users.where((u) => u['id'] != myId).toList();
            _postsCount = me.postsCount > 0 ? me.postsCount : posts.length;
            _followersCount = me.followersCount;
            _followingCount = me.followingCount;
            _isLoading = false;
          });
        }
      } else {
        final profile = await ApiClient.instance.getUserProfile(widget.userId!);
        final following = profile['isFollowing'] == true;

        List<Map<String, dynamic>> posts = [];
        try {
          posts = await ApiClient.instance.getUserPosts(widget.userId!);
        } catch (_) {}

        final int postsCount = (profile['postsCount'] ?? profile['posts_count'] ?? posts.length) as int;
        final int followers = (profile['followersCount'] ?? profile['followers_count'] ?? 0) as int;
        final int followingCount = (profile['followingCount'] ?? profile['following_count'] ?? 0) as int;

        if (mounted) {
          setState(() {
            _targetProfile = profile;
            _userPosts = posts;
            _isFollowing = following;
            _postsCount = postsCount;
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
    final oldFollowers = _followersCount;
    setState(() {
      _isFollowing = next;
      _followersCount = (next ? _followersCount + 1 : _followersCount - 1).clamp(0, 9999999);
      _isFollowingLoading = true;
    });

    try {
      final res = next
          ? await ApiClient.instance.follow(targetId)
          : await ApiClient.instance.unfollow(targetId);

      if (mounted) {
        setState(() {
          _isFollowing = res['isFollowing'] ?? next;
          if (res['targetFollowersCount'] != null) {
            _followersCount = (res['targetFollowersCount'] as num).toInt();
          }
          _isFollowingLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isFollowing = !next;
          _followersCount = oldFollowers;
          _isFollowingLoading = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to update follow status: $e'),
            backgroundColor: const Color(0xFFEF4444),
          ),
        );
      }
    }
  }

  Future<void> _followSuggestedUser(Map<String, dynamic> user) async {
    if (!ApiClient.instance.isAuthenticated) {
      Navigator.push(context, MaterialPageRoute(builder: (_) => const LoginPage()));
      return;
    }

    final uid = user['id']?.toString();
    if (uid == null) return;

    final prevStatus = user['isFollowing'] == true;
    final nextStatus = !prevStatus;
    final prevFollowingCount = _followingCount;

    // Immediate optimistic update on button and following count
    setState(() {
      user['isFollowing'] = nextStatus;
      if (_isOwnProfile) {
        _followingCount = (nextStatus ? _followingCount + 1 : _followingCount - 1).clamp(0, 9999999);
      }
    });

    try {
      final res = nextStatus
          ? await ApiClient.instance.follow(uid)
          : await ApiClient.instance.unfollow(uid);

      if (mounted && _isOwnProfile && res['currentUserFollowingCount'] != null) {
        setState(() {
          _followingCount = (res['currentUserFollowingCount'] as num).toInt();
        });
      }
    } catch (e) {
      // Safe rollback on error
      if (mounted) {
        setState(() {
          user['isFollowing'] = prevStatus;
          if (_isOwnProfile) {
            _followingCount = prevFollowingCount;
          }
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to update follow: $e'),
            backgroundColor: const Color(0xFFEF4444),
          ),
        );
      }
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
    _showEditProfileSheet();
  }

  void _showAvatarPickerSheet() {
    if (!_isOwnProfile || !ApiClient.instance.isAuthenticated) return;

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        decoration: const BoxDecoration(
          color: Color(0xFF1E2029),
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
        child: SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.white24,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 18),
              const Text(
                'Change Profile Photo',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 17,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 16),
              ListTile(
                leading: const Icon(Icons.camera_alt_outlined, color: Colors.white),
                title: const Text('Take photo with camera', style: TextStyle(color: Colors.white)),
                onTap: () {
                  Navigator.pop(ctx);
                  _captureWithCamera();
                },
              ),
              ListTile(
                leading: const Icon(Icons.photo_library_outlined, color: Colors.white),
                title: const Text('Choose from gallery / upload file', style: TextStyle(color: Colors.white)),
                onTap: () {
                  Navigator.pop(ctx);
                  _pickFromGallery();
                },
              ),
              if (_myProfile?.avatarUrl != null && _myProfile!.avatarUrl!.isNotEmpty)
                ListTile(
                  leading: const Icon(Icons.delete_outline, color: Color(0xFFEF4444)),
                  title: const Text('Remove current photo', style: TextStyle(color: Color(0xFFEF4444))),
                  onTap: () {
                    Navigator.pop(ctx);
                    _removeAvatar();
                  },
                ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _captureWithCamera() async {
    try {
      initCameraService();
      final result = await CameraService.instance.capturePhoto(context);
      if (!result.success || result.imagePath == null) return;
      await _uploadAvatarFile(File(result.imagePath!));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to capture photo: $e'),
            backgroundColor: const Color(0xFFEF4444),
          ),
        );
      }
    }
  }

  Future<void> _pickFromGallery() async {
    try {
      final picker = ImagePicker();
      final picked = await picker.pickImage(
        source: ImageSource.gallery,
        maxWidth: 1024,
        maxHeight: 1024,
        imageQuality: 85,
      );
      if (picked == null) return;
      await _uploadAvatarFile(File(picked.path));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to pick photo: $e'),
            backgroundColor: const Color(0xFFEF4444),
          ),
        );
      }
    }
  }

  Future<void> _uploadAvatarFile(File file) async {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Row(
            children: [
              SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
              ),
              SizedBox(width: 12),
              Text('Uploading profile photo...'),
            ],
          ),
          duration: Duration(seconds: 4),
        ),
      );
    }

    try {
      await ApiClient.instance.uploadAvatar(file);
      await _loadAllProfileData();

      if (mounted) {
        ScaffoldMessenger.of(context).hideCurrentSnackBar();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Profile photo updated successfully!'),
            backgroundColor: Color(0xFF10B981),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).hideCurrentSnackBar();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to upload photo: $e'),
            backgroundColor: const Color(0xFFEF4444),
          ),
        );
      }
    }
  }

  Future<void> _removeAvatar() async {
    try {
      await ApiClient.instance.deleteAvatar();
      await _loadAllProfileData();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Profile photo removed'),
            backgroundColor: Color(0xFF10B981),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to remove photo: $e'),
            backgroundColor: const Color(0xFFEF4444),
          ),
        );
      }
    }
  }

  void _showEditProfileSheet() {
    if (!ApiClient.instance.isAuthenticated) {
      Navigator.push(context, MaterialPageRoute(builder: (_) => const LoginPage()));
      return;
    }

    final usernameCtrl = TextEditingController(text: _myProfile?.username ?? '');
    final nameCtrl = TextEditingController(text: _myProfile?.fullName ?? '');
    final bioCtrl = TextEditingController(text: _myProfile?.bio ?? '');
    bool isSaving = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) {
          final avatarUrl = _myProfile?.avatarUrl;
          return Container(
            decoration: const BoxDecoration(
              color: Color(0xFF1E2029),
              borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
            ),
            padding: EdgeInsets.only(
              left: 20,
              right: 20,
              top: 16,
              bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
            ),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: Colors.white24,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      IconButton(
                        icon: const Icon(Icons.close, color: Colors.white70),
                        onPressed: () => Navigator.pop(ctx),
                      ),
                      const Text(
                        'Edit Profile',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      TextButton(
                        onPressed: isSaving
                            ? null
                            : () async {
                                final newUsername = usernameCtrl.text.trim();
                                if (newUsername.length < 3 || newUsername.length > 20) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(content: Text('Username must be 3-20 characters')),
                                  );
                                  return;
                                }

                                setModalState(() => isSaving = true);
                                try {
                                  await ApiClient.instance.updateProfile(
                                    username: newUsername,
                                    fullName: nameCtrl.text.trim(),
                                    bio: bioCtrl.text.trim(),
                                  );
                                  await _loadAllProfileData();
                                  if (ctx.mounted) Navigator.pop(ctx);
                                  if (mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(
                                        content: Text('Profile updated successfully!'),
                                        backgroundColor: Color(0xFF10B981),
                                      ),
                                    );
                                  }
                                } catch (e) {
                                  if (mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                        content: Text('Failed to update: $e'),
                                        backgroundColor: const Color(0xFFEF4444),
                                      ),
                                    );
                                  }
                                } finally {
                                  if (ctx.mounted) setModalState(() => isSaving = false);
                                }
                              },
                        child: isSaving
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF818CF8)),
                              )
                            : const Text(
                                'Save',
                                style: TextStyle(
                                  color: Color(0xFF818CF8),
                                  fontWeight: FontWeight.bold,
                                  fontSize: 16,
                                ),
                              ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  // Avatar with change photo action
                  Center(
                    child: Stack(
                      alignment: Alignment.bottomRight,
                      children: [
                        CircleAvatar(
                          radius: 44,
                          backgroundColor: const Color(0xFF2E3240),
                          backgroundImage: (avatarUrl != null && avatarUrl.isNotEmpty)
                              ? NetworkImage(avatarUrl)
                              : null,
                          child: (avatarUrl == null || avatarUrl.isEmpty)
                              ? const Icon(Icons.person, size: 44, color: Colors.white70)
                              : null,
                        ),
                        GestureDetector(
                          onTap: () {
                            Navigator.pop(ctx);
                            _showAvatarPickerSheet();
                          },
                          child: Container(
                            padding: const EdgeInsets.all(6),
                            decoration: const BoxDecoration(
                              color: Color(0xFF4F46E5),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.camera_alt, color: Colors.white, size: 16),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                  Center(
                    child: TextButton(
                      onPressed: () {
                        Navigator.pop(ctx);
                        _showAvatarPickerSheet();
                      },
                      child: const Text(
                        'Change photo',
                        style: TextStyle(color: Color(0xFF818CF8), fontSize: 13, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  // Username field
                  TextField(
                    controller: usernameCtrl,
                    style: const TextStyle(color: Colors.white),
                    decoration: InputDecoration(
                      labelText: 'Username *',
                      labelStyle: const TextStyle(color: Colors.white70),
                      prefixIcon: const Icon(Icons.person_outline, color: Colors.white54),
                      filled: true,
                      fillColor: const Color(0xFF262934),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                    ),
                  ),
                  const SizedBox(height: 14),
                  // Full name field
                  TextField(
                    controller: nameCtrl,
                    style: const TextStyle(color: Colors.white),
                    decoration: InputDecoration(
                      labelText: 'Full Name',
                      labelStyle: const TextStyle(color: Colors.white70),
                      prefixIcon: const Icon(Icons.badge_outlined, color: Colors.white54),
                      filled: true,
                      fillColor: const Color(0xFF262934),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                    ),
                  ),
                  const SizedBox(height: 14),
                  // Bio field
                  TextField(
                    controller: bioCtrl,
                    maxLines: 3,
                    style: const TextStyle(color: Colors.white),
                    decoration: InputDecoration(
                      labelText: 'Bio',
                      labelStyle: const TextStyle(color: Colors.white70),
                      prefixIcon: const Icon(Icons.description_outlined, color: Colors.white54),
                      filled: true,
                      fillColor: const Color(0xFF262934),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                    ),
                  ),
                  const SizedBox(height: 20),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  void _showMenuOptions() {
    _scaffoldKey.currentState?.openEndDrawer();
  }

  Widget _buildSocialSidebar(BuildContext context) {
    final String currentUsername = _isOwnProfile
        ? (_myProfile?.username ?? 'Profile')
        : (_targetProfile?['username']?.toString() ?? 'Profile');
    final String? userFullName = _isOwnProfile
        ? _myProfile?.fullName
        : _targetProfile?['fullName']?.toString();
    final String? currentAvatar = _isOwnProfile
        ? _myProfile?.avatarUrl
        : _targetProfile?['avatarUrl']?.toString();

    return Drawer(
      width: MediaQuery.of(context).size.width * 0.84,
      backgroundColor: Colors.white,
      elevation: 8,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.horizontal(left: Radius.circular(20)),
      ),
      child: SafeArea(
        child: Column(
          children: [
            // Top App Bar / Header matching TikTok/Insta
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              decoration: const BoxDecoration(
                color: Colors.white,
                border: Border(
                  bottom: BorderSide(color: Color(0xFFEBECEF), width: 1),
                ),
              ),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back, color: Color(0xFF161823), size: 22),
                    onPressed: () => Navigator.pop(context),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: InkWell(
                      onTap: _isOwnProfile
                          ? () {
                              Navigator.pop(context);
                              Navigator.push(
                                context,
                                MaterialPageRoute(builder: (_) => const SettingsAndPrivacyPage()),
                              );
                            }
                          : null,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(
                                _isOwnProfile ? 'Settings and privacy' : 'Account options',
                                style: const TextStyle(
                                  color: Color(0xFF161823),
                                  fontSize: 17,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              if (_isOwnProfile) ...[
                                const SizedBox(width: 4),
                                const Icon(Icons.chevron_right, color: Color(0xFFB0B3BA), size: 16),
                              ],
                            ],
                          ),
                          Text(
                            '@$currentUsername',
                            style: const TextStyle(
                              color: Color(0xFF737373),
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // Scrollable Content
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                children: [
                  if (_isOwnProfile) ...[
                    // ACCOUNT SECTION
                    _buildSectionHeader('Account'),
                    _buildSidebarTile(
                      icon: Icons.person_outline,
                      title: 'Account',
                      onTap: () {
                        Navigator.pop(context);
                      },
                    ),
                    _buildSidebarTile(
                      icon: Icons.lock_outline,
                      title: 'Privacy',
                      onTap: () {
                        Navigator.pop(context);
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const PrivacyAndSafetyScreen()),
                        );
                      },
                    ),
                    _buildSidebarTile(
                      icon: Icons.shield_outlined,
                      title: 'Security and permissions',
                      onTap: () {
                        Navigator.pop(context);
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const PrivacyAndSafetyScreen()),
                        );
                      },
                    ),
                    _buildSidebarTile(
                      icon: Icons.share_outlined,
                      title: 'Share profile',
                      onTap: () {
                        Navigator.pop(context);
                        _shareProfileLink(currentUsername);
                      },
                    ),

                    const SizedBox(height: 16),

                    // CONTENT & DISPLAY SECTION
                    _buildSectionHeader('Content & display'),
                    _buildSidebarTile(
                      icon: Icons.notifications_none,
                      title: 'Notifications',
                      onTap: () {
                        Navigator.pop(context);
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const NotificationPage()),
                        );
                      },
                    ),
                    _buildSidebarTile(
                      icon: Icons.access_time,
                      title: 'Activity centre',
                      onTap: () {
                        Navigator.pop(context);
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const ActivityPage()),
                        );
                      },
                    ),
                    _buildSidebarTile(
                      icon: Icons.bookmark_border,
                      title: 'Saved posts',
                      onTap: () {
                        Navigator.pop(context);
                        setState(() => _selectedTabIndex = 2);
                      },
                    ),
                    _buildSidebarTile(
                      icon: Icons.qr_code_scanner,
                      title: 'QR code',
                      onTap: () {
                        Navigator.pop(context);
                        _showQrCodeDialog(currentUsername, userFullName, currentAvatar);
                      },
                    ),
                    _buildSidebarTile(
                      icon: Icons.people_outline,
                      title: 'Audience controls & Blocked',
                      onTap: () {
                        Navigator.pop(context);
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const PrivacyAndSafetyScreen()),
                        );
                      },
                    ),

                    const SizedBox(height: 16),

                    // LOGIN SECTION
                    _buildSectionHeader('Login & session'),
                    _buildSidebarTile(
                      icon: Icons.logout,
                      title: 'Log out',
                      titleColor: const Color(0xFFFE2C55),
                      iconColor: const Color(0xFFFE2C55),
                      showChevron: false,
                      onTap: () {
                        Navigator.pop(context);
                        _confirmLogout();
                      },
                    ),
                  ] else ...[
                    // Options for someone else's profile
                    _buildSectionHeader('Interaction'),
                    _buildSidebarTile(
                      icon: Icons.share_outlined,
                      title: 'Share profile',
                      onTap: () {
                        Navigator.pop(context);
                        _shareProfileLink(currentUsername);
                      },
                    ),
                    _buildSidebarTile(
                      icon: Icons.link,
                      title: 'Copy profile link',
                      onTap: () {
                        Navigator.pop(context);
                        Clipboard.setData(ClipboardData(text: 'https://newsshare.app/u/$currentUsername'));
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Profile link copied to clipboard')),
                        );
                      },
                    ),
                    const SizedBox(height: 16),
                    _buildSectionHeader('Safety & Moderation'),
                    _buildSidebarTile(
                      icon: Icons.block,
                      title: 'Block account',
                      titleColor: const Color(0xFFFE2C55),
                      iconColor: const Color(0xFFFE2C55),
                      showChevron: false,
                      onTap: () {
                        Navigator.pop(context);
                        _blockOtherUser(currentUsername);
                      },
                    ),
                  ],
                  const SizedBox(height: 24),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 8, top: 8),
      child: Text(
        title,
        style: const TextStyle(
          color: Color(0xFF737373),
          fontSize: 12,
          fontWeight: FontWeight.bold,
          letterSpacing: 0.2,
        ),
      ),
    );
  }

  Widget _buildSidebarTile({
    required IconData icon,
    required String title,
    required VoidCallback onTap,
    Color? iconColor,
    Color? titleColor,
    bool showChevron = true,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Material(
        color: const Color(0xFFF8F8FA),
        borderRadius: BorderRadius.circular(10),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(10),
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFEBECEF), width: 0.8),
            ),
            child: ListTile(
              dense: true,
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
              leading: Icon(icon, color: iconColor ?? const Color(0xFF161823), size: 21),
              title: Text(
                title,
                style: TextStyle(
                  color: titleColor ?? const Color(0xFF161823),
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                ),
              ),
              trailing: showChevron
                  ? const Icon(Icons.chevron_right, color: Color(0xFFB0B3BA), size: 18)
                  : null,
            ),
          ),
        ),
      ),
    );
  }

  void _confirmLogout() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF161920),
        title: const Text('Log Out', style: TextStyle(color: Colors.white)),
        content: const Text(
          'Are you sure you want to log out of News Share?',
          style: TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel', style: TextStyle(color: Colors.white54)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFFE2C55)),
            onPressed: () async {
              Navigator.pop(ctx);
              await ApiClient.instance.logout();
              if (mounted) {
                Navigator.pushReplacement(
                  context,
                  MaterialPageRoute(builder: (_) => const LoginPage()),
                );
              }
            },
            child: const Text('Log Out', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  void _showQrCodeDialog(String username, String? fullName, String? avatarUrl) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF161920),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 10),
            CircleAvatar(
              radius: 36,
              backgroundColor: const Color(0xFF262A34),
              backgroundImage: (avatarUrl != null && avatarUrl.isNotEmpty)
                  ? NetworkImage(avatarUrl)
                  : null,
              child: (avatarUrl == null || avatarUrl.isEmpty)
                  ? Text(
                      username.isNotEmpty ? username[0].toUpperCase() : 'U',
                      style: const TextStyle(fontSize: 28, color: Colors.white, fontWeight: FontWeight.bold),
                    )
                  : null,
            ),
            const SizedBox(height: 12),
            Text(
              fullName?.isNotEmpty == true ? fullName! : username,
              style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
            ),
            Text(
              '@$username',
              style: const TextStyle(color: Colors.white54, fontSize: 13),
            ),
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Icon(
                Icons.qr_code_2,
                size: 140,
                color: Colors.black,
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'Scan with camera to view profile',
              style: TextStyle(color: Colors.white38, fontSize: 12),
            ),
          ],
        ),
        actions: [
          Center(
            child: TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Done', style: TextStyle(color: Color(0xFF3797EF), fontWeight: FontWeight.bold)),
            ),
          ),
        ],
      ),
    );
  }

  void _blockOtherUser(String username) async {
    final targetId = widget.userId;
    if (targetId == null) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF161920),
        title: const Text('Block User', style: TextStyle(color: Colors.white)),
        content: Text(
          'Are you sure you want to block @$username? They will not be able to follow you, view your posts, or message you.',
          style: const TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel', style: TextStyle(color: Colors.white54)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFFE2C55)),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Block', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      try {
        await ApiClient.instance.blockUser(targetId);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Blocked @$username'),
              backgroundColor: const Color(0xFFFE2C55),
            ),
          );
          Navigator.pop(context);
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Failed to block: $e'),
              backgroundColor: const Color(0xFFFE2C55),
            ),
          );
        }
      }
    }
  }

  void _openFollowersFollowing(int initialTabIndex) {
    final targetId = widget.userId ?? ApiClient.instance.currentUserId;
    if (targetId == null || targetId.isEmpty) return;
    final uname = _isOwnProfile
        ? (_myProfile?.username ?? 'Profile')
        : (_targetProfile?['username']?.toString() ?? 'Profile');

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => FollowersFollowingPage(
          userId: targetId,
          username: uname,
          initialTabIndex: initialTabIndex,
          initialFollowersCount: _followersCount,
          initialFollowingCount: _followingCount,
        ),
      ),
    ).then((_) {
      _loadAllProfileData();
    });
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
      key: _scaffoldKey,
      endDrawer: _buildSocialSidebar(context),
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
                          _buildStatColumn('$_postsCount', 'posts'),
                          _buildStatColumn(
                            '$_followersCount',
                            'followers',
                            onTap: () => _openFollowersFollowing(0),
                          ),
                          _buildStatColumn(
                            '$_followingCount',
                            'following',
                            onTap: () => _openFollowersFollowing(1),
                          ),
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

              if (_isHighlightsExpanded && _isOwnProfile) ...[
                const SizedBox(height: 12),
                SizedBox(
                  height: 84,
                  child: ListView(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    scrollDirection: Axis.horizontal,
                    children: [
                      // Real "New" highlight creation button for own profile
                      InkWell(
                        onTap: () {
                          Navigator.push(context, MaterialPageRoute(builder: (_) => const PostPage()));
                        },
                        borderRadius: BorderRadius.circular(30),
                        child: Column(
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
                      ),
                    ],
                  ),
                ),
              ],

              const SizedBox(height: 14),

              // ===================== 6. 3 TABS (GRID, MEDIA/REELS, TAGGED/SAVED) =====================
              Container(
                decoration: const BoxDecoration(
                  border: Border(
                    top: BorderSide(color: Color(0xFF1E222B), width: 1),
                  ),
                ),
                child: Row(
                  children: [
                    _buildTabItem(icon: Icons.grid_on_sharp, index: 0),
                    _buildTabItem(icon: Icons.videocam_outlined, index: 1),
                    _buildTabItem(icon: Icons.bookmark_outline, index: 2),
                  ],
                ),
              ),

              // ===================== 7. 3-COLUMN SQUARE POSTS GRID =====================
              if (_currentTabPosts.isEmpty)
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
                        child: Icon(
                          _selectedTabIndex == 2
                              ? Icons.bookmark_border
                              : (_selectedTabIndex == 1 ? Icons.videocam_outlined : Icons.camera_alt_outlined),
                          color: Colors.white54,
                          size: 34,
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        _selectedTabIndex == 2
                            ? 'No Saved Posts'
                            : (_selectedTabIndex == 1 ? 'No Media Posts' : 'Share Photos and Videos'),
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        _selectedTabIndex == 2
                            ? 'Save posts from the feed to view them here later.'
                            : (_selectedTabIndex == 1
                                ? 'Posts with images and media will appear here.'
                                : 'When you share news or updates, they appear on your profile.'),
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: Colors.white60, fontSize: 13),
                      ),
                      if (_isOwnProfile && _selectedTabIndex == 0) ...[
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
                  itemCount: _currentTabPosts.length,
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 3,
                    crossAxisSpacing: 2,
                    mainAxisSpacing: 2,
                    childAspectRatio: 1.0,
                  ),
                  itemBuilder: (context, index) {
                    final post = _currentTabPosts[index];
                    final rawImage = post['imageUrl']?.toString() ?? post['image_url']?.toString();
                    final resolvedImage = _resolveMediaUrl(rawImage);
                    final title = post['title']?.toString() ?? 'News';
                    final postId = post['id']?.toString() ?? '';

                    return GestureDetector(
                      onTap: () {
                        if (postId.isNotEmpty) {
                          PostActionsSheet.show(
                            context,
                            postId: postId,
                            postUserId: post['userId']?.toString() ?? (post['author'] as Map?)?['id']?.toString(),
                            postTitle: title,
                            postUrl: resolvedImage,
                            isSaved: post['isSaved'] == true,
                            onDelete: () {
                              _loadAllProfileData();
                            },
                          );
                        }
                      },
                      child: Container(
                        color: const Color(0xFF14171E),
                        child: (resolvedImage != null && resolvedImage.startsWith('http'))
                            ? Image.network(
                                resolvedImage,
                                fit: BoxFit.cover,
                                errorBuilder: (context, error, stackTrace) => _buildPostTilePlaceholder(title),
                              )
                            : _buildPostTilePlaceholder(title),
                      ),
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
        GestureDetector(
          onTap: _isOwnProfile ? _showAvatarPickerSheet : null,
          child: Container(
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
        ),
        if (_isOwnProfile)
          Positioned(
            bottom: 0,
            right: 0,
            child: GestureDetector(
              onTap: _showAvatarPickerSheet,
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

  Widget _buildStatColumn(String count, String label, {VoidCallback? onTap}) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Column(
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
      ),
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

  String? _resolveMediaUrl(String? url) {
    if (url == null || url.trim().isEmpty) return null;
    final trimmed = url.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    final base = ApiClient.instance.baseUrl;
    return trimmed.startsWith('/') ? '$base$trimmed' : '$base/$trimmed';
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
