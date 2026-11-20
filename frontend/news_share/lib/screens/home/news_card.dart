/*
  TikTok/Reels-style full-screen vertical news card with real backend integration:
  - Publisher profile avatar & username tap -> ProfilePage
  - Follow (+) button -> follows/unfollows publisher via ApiClient.follow/unfollow
  - Like button & double tap -> likes/unlikes via ApiClient.likePost/unlikePost
  - Comment button -> opens CommentsSheet with real comment creation/retrieval
  - Save button -> saves/unsaves post via ApiClient.savePost/unsavePost
  - Share button & 3-dot menu -> opens PostActionsSheet with suggested users, social sharing, Report, and Not Interested.
*/

import 'package:flutter/material.dart';
import '../../models/news_item.dart';
import '../../services/api_client.dart';
import '../moderation/post_actions_sheet.dart';
import '../post/comments_sheet.dart';
import '../profile/profile_page.dart';
import '../auth/login.dart';

class NewsCard extends StatefulWidget {
  final NewsItem? item;
  final bool isLoading;
  final VoidCallback? onEdit;
  final VoidCallback? onDelete;
  final VoidCallback? onHidePost;
  final VoidCallback? onSearchTap;

  const NewsCard({
    super.key,
    this.item,
    this.isLoading = false,
    this.onEdit,
    this.onDelete,
    this.onHidePost,
    this.onSearchTap,
  });

  @override
  State<NewsCard> createState() => _NewsCardState();
}

class _NewsCardState extends State<NewsCard> with SingleTickerProviderStateMixin {
  bool _isExpanded = false;
  late bool _isLiked;
  late int _likeCount;
  late bool _isSaved;
  late int _savesCount;
  late bool _isFollowing;
  late int _commentsCount;
  late int _sharesCount;
  bool _showHeartAnimation = false;
  late AnimationController _animController;

  @override
  void initState() {
    super.initState();
    _isLiked = widget.item?.isLiked ?? false;
    _likeCount = widget.item?.likesCount ?? 0;
    _isSaved = widget.item?.isSaved ?? false;
    _savesCount = widget.item?.savesCount ?? 0;
    _isFollowing = widget.item?.isFollowing ?? false;
    _commentsCount = widget.item?.commentsCount ?? 0;
    _sharesCount = widget.item?.sharesCount ?? 80;

    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
  }

  @override
  void didUpdateWidget(covariant NewsCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.item != widget.item && widget.item != null) {
      _isLiked = widget.item!.isLiked;
      _likeCount = widget.item!.likesCount;
      _isSaved = widget.item!.isSaved;
      _savesCount = widget.item!.savesCount;
      _isFollowing = widget.item!.isFollowing;
      _commentsCount = widget.item!.commentsCount;
      _sharesCount = widget.item!.sharesCount;
    }
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  String _extractText(dynamic field) {
    if (field == null) return '';
    if (field is Map<String, dynamic>) {
      return field['name']?.toString() ?? '';
    }
    try {
      return field.name?.toString() ?? '';
    } catch (_) {}
    return field.toString();
  }

  bool get _isOwnPost {
    final myId = ApiClient.instance.currentUserId;
    final postUserId = widget.item?.userId;
    return myId != null && postUserId != null && myId == postUserId;
  }

  Future<void> _handleLikeToggle() async {
    if (!ApiClient.instance.isAuthenticated) {
      Navigator.push(context, MaterialPageRoute(builder: (_) => const LoginPage()));
      return;
    }
    final postId = widget.item?.id ?? '';
    if (postId.isEmpty) return;

    final next = !_isLiked;
    setState(() {
      _isLiked = next;
      _likeCount += next ? 1 : -1;
    });

    try {
      if (next) {
        final res = await ApiClient.instance.likePost(postId);
        if (mounted && res['likesCount'] is int) {
          setState(() => _likeCount = res['likesCount'] as int);
        }
      } else {
        final res = await ApiClient.instance.unlikePost(postId);
        if (mounted && res['likesCount'] is int) {
          setState(() => _likeCount = res['likesCount'] as int);
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLiked = !next;
          _likeCount += !next ? 1 : -1;
        });
      }
    }
  }

  void _handleDoubleTap() {
    if (!_isLiked) {
      _handleLikeToggle();
    }
    setState(() => _showHeartAnimation = true);
    _animController.forward(from: 0.0).then((_) {
      if (mounted) setState(() => _showHeartAnimation = false);
    });
  }

  Future<void> _handleFollowToggle() async {
    if (!ApiClient.instance.isAuthenticated) {
      Navigator.push(context, MaterialPageRoute(builder: (_) => const LoginPage()));
      return;
    }
    final authorId = widget.item?.userId;
    if (authorId == null || authorId.isEmpty) return;
    if (_isOwnPost) return;

    final next = !_isFollowing;
    setState(() => _isFollowing = next);

    try {
      if (next) {
        await ApiClient.instance.follow(authorId);
      } else {
        await ApiClient.instance.unfollow(authorId);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isFollowing = !next);
      }
    }
  }

  Future<void> _handleSaveToggle() async {
    if (!ApiClient.instance.isAuthenticated) {
      Navigator.push(context, MaterialPageRoute(builder: (_) => const LoginPage()));
      return;
    }
    final postId = widget.item?.id ?? '';
    if (postId.isEmpty) return;

    final next = !_isSaved;
    setState(() {
      _isSaved = next;
      _savesCount += next ? 1 : -1;
    });

    try {
      if (next) {
        await ApiClient.instance.savePost(postId);
      } else {
        await ApiClient.instance.unsavePost(postId);
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(next ? 'Saved to bookmarks' : 'Removed from bookmarks'),
            behavior: SnackBarBehavior.floating,
            duration: const Duration(seconds: 1),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isSaved = !next;
          _savesCount += !next ? 1 : -1;
        });
      }
    }
  }

  void _openComments() {
    final postId = widget.item?.id ?? '';
    if (postId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Comments are available for community news stories'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    CommentsSheet.show(
      context,
      postId: postId,
      initialCount: _commentsCount,
      onCountChanged: (newCount) {
        setState(() => _commentsCount = newCount);
      },
    );
  }

  void _openProfile() {
    final authorId = widget.item?.userId;
    if (authorId == null || authorId.isEmpty) return;

    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => ProfilePage(userId: authorId)),
    );
  }

  void _openShareSheet() {
    final item = widget.item;
    if (item == null) return;
    final titleText = _extractText(item.title);

    PostActionsSheet.show(
      context,
      postId: item.id ?? '',
      postUserId: item.userId,
      postTitle: titleText,
      postUrl: item.url.isNotEmpty ? item.url : null,
      sourceName: item.source,
      isSaved: _isSaved,
      onHidePost: widget.onHidePost,
      onEdit: widget.onEdit,
      onDelete: widget.onDelete,
    );
  }

  Widget _buildSkeleton() {
    return Container(
      color: const Color(0xFF0F172A),
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: const [
            CircularProgressIndicator(color: Color(0xFF00F2FE), strokeWidth: 2.5),
            SizedBox(height: 16),
            Text('Loading news...', style: TextStyle(color: Colors.white70)),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (widget.isLoading || widget.item == null) return _buildSkeleton();

    final item = widget.item!;
    final titleText = _extractText(item.title);
    final subtitleText = _extractText(item.subtitle);
    final imageUrl = item.imageUrl;

    return GestureDetector(
      onDoubleTap: _handleDoubleTap,
      child: Container(
        color: Colors.black,
        width: double.infinity,
        height: double.infinity,
        child: Stack(
          fit: StackFit.expand,
          children: [
            // 1. FULL-SCREEN BACKGROUND MEDIA
            if (imageUrl.isNotEmpty && imageUrl.startsWith('http'))
              Image.network(
                imageUrl,
                fit: BoxFit.cover,
                width: double.infinity,
                height: double.infinity,
                errorBuilder: (_, __, ___) => _buildFallbackBackground(item),
              )
            else
              _buildFallbackBackground(item),

            // 2. TOP GRADIENT OVERLAY
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              height: 140,
              child: Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Color(0x99000000),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),

            // 3. BOTTOM DEEP GRADIENT OVERLAY
            Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              height: 420,
              child: Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.transparent,
                      Color(0x40000000),
                      Color(0xB3000000),
                      Color(0xF2000000),
                    ],
                  ),
                ),
              ),
            ),

            // 4. TOP-RIGHT SEARCH ICON (Matching reference screenshot)
            Positioned(
              top: 18,
              right: 18,
              child: SafeArea(
                bottom: false,
                child: GestureDetector(
                  onTap: () {
                    if (widget.onSearchTap != null) {
                      widget.onSearchTap!();
                    } else {
                      _openShareSheet();
                    }
                  },
                  child: Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: Colors.black.withOpacity(0.45),
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white24, width: 1),
                    ),
                    child: const Icon(Icons.search, color: Colors.white, size: 22),
                  ),
                ),
              ),
            ),

            // 5. DOUBLE-TAP HEART ANIMATION OVERLAY
            if (_showHeartAnimation)
              Center(
                child: ScaleTransition(
                  scale: Tween<double>(begin: 0.5, end: 1.4).animate(
                    CurvedAnimation(parent: _animController, curve: Curves.elasticOut),
                  ),
                  child: const Icon(
                    Icons.favorite,
                    color: Color(0xFFFE2C55),
                    size: 110,
                  ),
                ),
              ),

            // 6. RIGHT-SIDE VERTICAL INTERACTION RAIL
            Positioned(
              right: 12,
              bottom: 30,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Publisher avatar with Follow (+) button
                  _buildPublisherAvatar(item),
                  const SizedBox(height: 18),

                  // Like button with real count
                  _buildRailButton(
                    icon: _isLiked ? Icons.favorite : Icons.favorite_border,
                    iconColor: _isLiked ? const Color(0xFFFE2C55) : Colors.white,
                    label: '$_likeCount',
                    onTap: _handleLikeToggle,
                  ),
                  const SizedBox(height: 16),

                  // Comment button with real count
                  _buildRailButton(
                    icon: Icons.chat_bubble_rounded,
                    iconColor: Colors.white,
                    label: '$_commentsCount',
                    onTap: _openComments,
                  ),
                  const SizedBox(height: 16),

                  // Save / Bookmark button
                  _buildRailButton(
                    icon: _isSaved ? Icons.bookmark : Icons.bookmark_border,
                    iconColor: _isSaved ? const Color(0xFF00F2FE) : Colors.white,
                    label: _savesCount > 0 ? '$_savesCount' : (_isSaved ? 'Saved' : 'Save'),
                    onTap: _handleSaveToggle,
                  ),
                  const SizedBox(height: 16),

                  // Share button with count
                  _buildRailButton(
                    icon: Icons.share_rounded,
                    iconColor: Colors.white,
                    label: '$_sharesCount',
                    onTap: _openShareSheet,
                  ),
                  const SizedBox(height: 16),

                  // Three-dot post menu (...)
                  _buildRailButton(
                    icon: Icons.more_horiz,
                    iconColor: Colors.white70,
                    label: '',
                    onTap: _openShareSheet,
                    isCompact: true,
                  ),
                ],
              ),
            ),

            // 7. BOTTOM-LEFT TEXT OVERLAY
            Positioned(
              left: 16,
              right: 88,
              bottom: 24,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Publisher username pill + verification indicator + publication time
                  Row(
                    children: [
                      GestureDetector(
                        onTap: _openProfile,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.2),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: Colors.white24, width: 0.8),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                item.source,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 13,
                                ),
                              ),
                              if (item.isVerified) ...[
                                const SizedBox(width: 4),
                                const Icon(Icons.verified, color: Color(0xFF00F2FE), size: 14),
                              ],
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        item.timeAgo,
                        style: const TextStyle(
                          color: Colors.white70,
                          fontSize: 12,
                          fontWeight: FontWeight.w400,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),

                  // Headline
                  Text(
                    titleText,
                    maxLines: _isExpanded ? 10 : 3,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 17,
                      fontWeight: FontWeight.w700,
                      height: 1.25,
                      shadows: [
                        Shadow(color: Colors.black87, blurRadius: 4, offset: Offset(0, 1)),
                      ],
                    ),
                  ),

                  // Expandable description
                  if (subtitleText.isNotEmpty && subtitleText != titleText) ...[
                    const SizedBox(height: 6),
                    Text(
                      _isExpanded
                          ? subtitleText
                          : (subtitleText.length > 85
                              ? '${subtitleText.substring(0, 85)}...'
                              : subtitleText),
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.85),
                        fontSize: 13.5,
                        height: 1.3,
                      ),
                    ),
                    if (subtitleText.length > 85)
                      GestureDetector(
                        onTap: () => setState(() => _isExpanded = !_isExpanded),
                        child: Padding(
                          padding: const EdgeInsets.only(top: 2),
                          child: Text(
                            _isExpanded ? 'See less' : 'See more',
                            style: const TextStyle(
                              color: Color(0xFF00F2FE),
                              fontWeight: FontWeight.w600,
                              fontSize: 13,
                            ),
                          ),
                        ),
                      ),
                  ],

                  const SizedBox(height: 10),

                  // Category pill
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFE2C55).withOpacity(0.25),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFFE2C55).withOpacity(0.6), width: 1),
                    ),
                    child: Text(
                      '#${item.category.toLowerCase().replaceAll(' ', '')}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 11.5,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPublisherAvatar(NewsItem item) {
    final avatarUrl = item.authorAvatarUrl;
    final initial = item.source.isNotEmpty ? item.source[0].toUpperCase() : 'U';

    return Stack(
      clipBehavior: Clip.none,
      children: [
        GestureDetector(
          onTap: _openProfile,
          child: Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: const LinearGradient(
                colors: [Color(0xFFFE2C55), Color(0xFF00F2FE)],
              ),
              boxShadow: const [
                BoxShadow(color: Colors.black45, blurRadius: 6, offset: Offset(0, 2)),
              ],
            ),
            padding: const EdgeInsets.all(2),
            child: Container(
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: Color(0xFF1E293B),
              ),
              clipBehavior: Clip.antiAlias,
              child: (avatarUrl != null && avatarUrl.startsWith('http'))
                  ? Image.network(
                      avatarUrl,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => Center(
                        child: Text(
                          initial,
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 18,
                          ),
                        ),
                      ),
                    )
                  : Center(
                      child: Text(
                        initial,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 18,
                        ),
                      ),
                    ),
            ),
          ),
        ),

        // Follow (+) button: hidden if own post; toggles follow/unfollow
        if (!_isOwnPost && item.userId != null)
          Positioned(
            bottom: -6,
            left: 14,
            child: GestureDetector(
              onTap: _handleFollowToggle,
              child: Container(
                width: 20,
                height: 20,
                decoration: BoxDecoration(
                  color: _isFollowing ? const Color(0xFF10B981) : const Color(0xFFFE2C55),
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 1.5),
                ),
                child: Icon(
                  _isFollowing ? Icons.check : Icons.add,
                  color: Colors.white,
                  size: 13,
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildRailButton({
    required IconData icon,
    required Color iconColor,
    required String label,
    required VoidCallback onTap,
    bool isCompact = false,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        children: [
          Container(
            width: isCompact ? 38 : 44,
            height: isCompact ? 38 : 44,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: Colors.black.withOpacity(0.4),
            ),
            child: Icon(icon, color: iconColor, size: isCompact ? 22 : 28),
          ),
          if (label.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              label,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 11.5,
                fontWeight: FontWeight.w600,
                shadows: [
                  Shadow(color: Colors.black87, blurRadius: 3, offset: Offset(0, 1)),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildFallbackBackground(NewsItem item) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFF0F172A),
            Color(0xFF1E293B),
            Color(0xFF334155),
            Color(0xFF0F172A),
          ],
        ),
      ),
      child: Center(
        child: Icon(
          Icons.newspaper_rounded,
          size: 110,
          color: Colors.white.withOpacity(0.08),
        ),
      ),
    );
  }
}
