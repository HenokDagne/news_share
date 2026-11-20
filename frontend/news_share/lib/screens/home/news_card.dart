/*
  TikTok/Reels-style full-screen vertical news card with full-bleed media background,
  dark readability gradients, right-side floating action rail (Like, Comment, Save, Share, More),
  and bottom overlay with source, title, expandable description, and category tag.
*/

import 'package:flutter/material.dart';
import '../../models/news_item.dart';
import '../../services/api_client.dart';
import '../moderation/post_actions_sheet.dart';

class NewsCard extends StatefulWidget {
  final NewsItem? item;
  final bool isLoading;
  final VoidCallback? onEdit;
  final VoidCallback? onDelete;
  final VoidCallback? onHidePost;

  const NewsCard({
    super.key,
    this.item,
    this.isLoading = false,
    this.onEdit,
    this.onDelete,
    this.onHidePost,
  });

  @override
  State<NewsCard> createState() => _NewsCardState();
}

class _NewsCardState extends State<NewsCard> with SingleTickerProviderStateMixin {
  bool _isExpanded = false;
  bool _isLiked = false;
  int _likeCount = 420;
  bool _isSaved = false;
  bool _showHeartAnimation = false;
  late AnimationController _animController;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
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

  void _handleLikeToggle() {
    setState(() {
      _isLiked = !_isLiked;
      _likeCount += _isLiked ? 1 : -1;
    });
  }

  void _handleDoubleTap() {
    if (!_isLiked) {
      setState(() {
        _isLiked = true;
        _likeCount += 1;
      });
    }
    setState(() => _showHeartAnimation = true);
    _animController.forward(from: 0.0).then((_) {
      if (mounted) setState(() => _showHeartAnimation = false);
    });
  }

  void _handleSaveToggle() async {
    final nextState = !_isSaved;
    setState(() => _isSaved = nextState);
    final postId = widget.item?.id ?? '';
    if (postId.isNotEmpty) {
      try {
        if (nextState) {
          await ApiClient.instance.savePost(postId);
        } else {
          await ApiClient.instance.unsavePost(postId);
        }
      } catch (e) {
        setState(() => _isSaved = !nextState);
      }
    }
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(nextState ? 'Saved to bookmarks' : 'Removed from bookmarks'),
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 1),
        ),
      );
    }
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
            CircularProgressIndicator(color: Colors.white70),
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
            // 1. FULL-SCREEN BACKGROUND IMAGE OR GRADIENT
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

            // 2. TOP GRADIENT OVERLAY (for status bar / top buttons readability)
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              height: 120,
              child: Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Color(0x80000000),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),

            // 3. BOTTOM DEEP GRADIENT OVERLAY (for high-contrast white text)
            Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              height: 380,
              child: Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.transparent,
                      Color(0x60000000),
                      Color(0xCC000000),
                      Color(0xF0000000),
                    ],
                  ),
                ),
              ),
            ),

            // 4. DOUBLE-TAP HEART ANIMATION OVERLAY
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

            // 5. RIGHT FLOATING ACTION RAIL (TikTok-style vertical buttons)
            Positioned(
              right: 12,
              bottom: 24,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Author avatar with gradient ring and follow '+' badge
                  _buildAuthorAvatar(item),
                  const SizedBox(height: 18),

                  // Like button
                  _buildRailButton(
                    icon: _isLiked ? Icons.favorite : Icons.favorite_border,
                    iconColor: _isLiked ? const Color(0xFFFE2C55) : Colors.white,
                    label: '$_likeCount',
                    onTap: _handleLikeToggle,
                  ),
                  const SizedBox(height: 16),

                  // Comment button
                  _buildRailButton(
                    icon: Icons.chat_bubble_rounded,
                    iconColor: Colors.white,
                    label: '120',
                    onTap: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Comments section opening...'),
                          behavior: SnackBarBehavior.floating,
                          duration: Duration(seconds: 1),
                        ),
                      );
                    },
                  ),
                  const SizedBox(height: 16),

                  // Save / Bookmark button
                  _buildRailButton(
                    icon: _isSaved ? Icons.bookmark : Icons.bookmark_border,
                    iconColor: _isSaved ? const Color(0xFF00F2FE) : Colors.white,
                    label: _isSaved ? 'Saved' : 'Save',
                    onTap: _handleSaveToggle,
                  ),
                  const SizedBox(height: 16),

                  // Share button (Opens TikTok-style Share Sheet)
                  _buildRailButton(
                    icon: Icons.share_rounded,
                    iconColor: Colors.white,
                    label: '80',
                    onTap: _openShareSheet,
                  ),
                  const SizedBox(height: 16),

                  // More options button (...)
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

            // 6. BOTTOM-LEFT TEXT OVERLAY (Source, Title, Subtitle, Category)
            Positioned(
              left: 16,
              right: 88,
              bottom: 24,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Source & timestamp
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.18),
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
                            const SizedBox(width: 4),
                            const Icon(Icons.verified, color: Color(0xFF00F2FE), size: 14),
                          ],
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

                  // Title
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

                  // Subtitle / Description (expandable)
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

                  // Category tag
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFE2C55).withOpacity(0.2),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFFE2C55).withOpacity(0.5), width: 1),
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

  Widget _buildAuthorAvatar(NewsItem item) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Container(
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
            child: Center(
              child: Text(
                item.source.isNotEmpty ? item.source[0].toUpperCase() : 'N',
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 18,
                ),
              ),
            ),
          ),
        ),
        Positioned(
          bottom: -6,
          left: 14,
          child: Container(
            width: 20,
            height: 20,
            decoration: const BoxDecoration(
              color: Color(0xFFFE2C55),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.add, color: Colors.white, size: 14),
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
              color: Colors.black.withOpacity(0.35),
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
          size: 100,
          color: Colors.white.withOpacity(0.08),
        ),
      ),
    );
  }
}
