import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';
import '../../services/api_client.dart';
import 'report_sheet.dart';

class PostActionsSheet extends StatefulWidget {
  final String postId;
  final String? postUserId;
  final String? postTitle;
  final String? postUrl;
  final String? sourceName;
  final bool isSaved;
  final VoidCallback? onHidePost;
  final VoidCallback? onEdit;
  final VoidCallback? onDelete;

  const PostActionsSheet({
    super.key,
    required this.postId,
    this.postUserId,
    this.postTitle,
    this.postUrl,
    this.sourceName,
    this.isSaved = false,
    this.onHidePost,
    this.onEdit,
    this.onDelete,
  });

  static Future<void> show(
    BuildContext context, {
    required String postId,
    String? postUserId,
    String? postTitle,
    String? postUrl,
    String? sourceName,
    bool isSaved = false,
    VoidCallback? onHidePost,
    VoidCallback? onEdit,
    VoidCallback? onDelete,
  }) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => PostActionsSheet(
        postId: postId,
        postUserId: postUserId,
        postTitle: postTitle,
        postUrl: postUrl,
        sourceName: sourceName,
        isSaved: isSaved,
        onHidePost: onHidePost,
        onEdit: onEdit,
        onDelete: onDelete,
      ),
    );
  }

  @override
  State<PostActionsSheet> createState() => _PostActionsSheetState();
}

class _PostActionsSheetState extends State<PostActionsSheet> {
  List<Map<String, dynamic>> _users = [];
  bool _isLoadingUsers = true;
  bool _isSearching = false;
  final TextEditingController _searchController = TextEditingController();
  late bool _savedState;

  @override
  void initState() {
    super.initState();
    _savedState = widget.isSaved;
    _loadUsers();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadUsers([String? query]) async {
    try {
      final users = await ApiClient.instance.getUsers(search: query, limit: 20);
      if (mounted) {
        setState(() {
          _users = users;
          _isLoadingUsers = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoadingUsers = false;
        });
      }
    }
  }

  String _getShareUrl() {
    if (widget.postUrl != null && widget.postUrl!.isNotEmpty) {
      return widget.postUrl!;
    }
    if (widget.postId.isNotEmpty) {
      return 'https://newsshare.app/posts/${widget.postId}';
    }
    return 'https://newsshare.app';
  }

  String _getShareText() {
    final title = widget.postTitle ?? 'Check out this news on NewsShare';
    final url = _getShareUrl();
    return '$title\n$url';
  }

  void _copyLink() {
    final url = _getShareUrl();
    Clipboard.setData(ClipboardData(text: url));
    Navigator.pop(context);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Link copied to clipboard!'),
        behavior: SnackBarBehavior.floating,
        duration: Duration(seconds: 2),
      ),
    );
  }

  void _shareViaNative() async {
    Navigator.pop(context);
    try {
      await SharePlus.instance.share(ShareParams(text: _getShareText()));
    } catch (e) {
      debugPrint('Share error: $e');
    }
  }

  void _sendToUser(Map<String, dynamic> user) {
    final name = user['fullName'] ?? user['username'] ?? 'User';
    Navigator.pop(context);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Sent to $name!'),
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 2),
      ),
    );
  }

  void _handleNotInterested() async {
    Navigator.pop(context);
    widget.onHidePost?.call();

    if (widget.postId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Post hidden from your feed'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    try {
      await ApiClient.instance.setNotInterested(widget.postId);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Post hidden from your feed'),
            behavior: SnackBarBehavior.floating,
            action: SnackBarAction(
              label: 'Undo',
              textColor: const Color(0xFF00F2FE),
              onPressed: () async {
                try {
                  await ApiClient.instance.undoNotInterested(widget.postId);
                } catch (err) {
                  debugPrint('Undo error: $err');
                }
              },
            ),
          ),
        );
      }
    } catch (e) {
      debugPrint('Not-interested error: $e');
    }
  }

  void _handleReport() {
    Navigator.pop(context);
    if (widget.postId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('External news headlines cannot be reported as user posts.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    ReportSheet.show(
      context,
      targetId: widget.postId,
      targetType: 'POST',
      targetTitle: widget.postTitle,
    );
  }

  void _handleSaveToggle() async {
    final nextState = !_savedState;
    setState(() => _savedState = nextState);
    try {
      if (nextState) {
        await ApiClient.instance.savePost(widget.postId);
      } else {
        await ApiClient.instance.unsavePost(widget.postId);
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(nextState ? 'Saved to your bookmarks' : 'Removed from bookmarks'),
            behavior: SnackBarBehavior.floating,
            duration: const Duration(seconds: 2),
          ),
        );
      }
    } catch (e) {
      setState(() => _savedState = !nextState);
    }
  }

  @override
  Widget build(BuildContext context) {
    final currentUserId = ApiClient.instance.currentUserId;
    final isOwn = currentUserId != null && currentUserId == widget.postUserId;

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: const EdgeInsets.only(top: 14, bottom: 20),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Drag indicator
            Center(
              child: Container(
                height: 4,
                width: 38,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 10),

            // Header: Search icon, "Send to" centered title, Close button
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  IconButton(
                    icon: Icon(
                      _isSearching ? Icons.arrow_back : Icons.search,
                      color: Colors.black87,
                      size: 24,
                    ),
                    onPressed: () {
                      setState(() {
                        _isSearching = !_isSearching;
                        if (!_isSearching) {
                          _searchController.clear();
                          _loadUsers();
                        }
                      });
                    },
                  ),
                  Expanded(
                    child: _isSearching
                        ? TextField(
                            controller: _searchController,
                            autofocus: true,
                            decoration: const InputDecoration(
                              hintText: 'Search people...',
                              border: InputBorder.none,
                              isDense: true,
                            ),
                            style: const TextStyle(fontSize: 15),
                            onChanged: (val) => _loadUsers(val),
                          )
                        : const Text(
                            'Send to',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: Colors.black,
                            ),
                          ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, color: Colors.black87, size: 24),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),

            // ROW 1: Suggested users (horizontal scroll)
            SizedBox(
              height: 96,
              child: _isLoadingUsers
                  ? const Center(
                      child: SizedBox(
                        width: 24,
                        height: 24,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                    )
                  : _users.isEmpty
                      ? Center(
                          child: Text(
                            'No suggested users found',
                            style: TextStyle(color: Colors.grey.shade500, fontSize: 13),
                          ),
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          scrollDirection: Axis.horizontal,
                          itemCount: _users.length,
                          separatorBuilder: (_, __) => const SizedBox(width: 14),
                          itemBuilder: (context, index) {
                            final u = _users[index];
                            final username = u['username']?.toString() ?? 'user';
                            final fullName = u['fullName']?.toString() ?? username;
                            final avatarUrl = u['avatarUrl']?.toString();

                            return GestureDetector(
                              onTap: () => _sendToUser(u),
                              child: SizedBox(
                                width: 68,
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Container(
                                      width: 56,
                                      height: 56,
                                      decoration: BoxDecoration(
                                        shape: BoxShape.circle,
                                        color: Colors.grey.shade200,
                                        border: Border.all(color: Colors.grey.shade300, width: 1),
                                      ),
                                      clipBehavior: Clip.antiAlias,
                                      child: (avatarUrl != null && avatarUrl.startsWith('http'))
                                          ? Image.network(
                                              avatarUrl,
                                              fit: BoxFit.cover,
                                              errorBuilder: (_, __, ___) => _buildAvatarFallback(fullName),
                                            )
                                          : _buildAvatarFallback(fullName),
                                    ),
                                    const SizedBox(height: 6),
                                    Text(
                                      fullName.isNotEmpty ? fullName : username,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      textAlign: TextAlign.center,
                                      style: const TextStyle(
                                        fontSize: 11.5,
                                        fontWeight: FontWeight.w400,
                                        color: Colors.black87,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
            ),
            const SizedBox(height: 14),
            Divider(height: 1, color: Colors.grey.shade200),
            const SizedBox(height: 14),

            // ROW 2: Sharing apps (Telegram, Copy link, WhatsApp, Status, Facebook, More/SMS)
            SizedBox(
              height: 84,
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                scrollDirection: Axis.horizontal,
                children: [
                  _buildSocialAppItem(
                    label: 'Telegram',
                    color: const Color(0xFF2AABEE),
                    icon: Icons.send_rounded,
                    onTap: _shareViaNative,
                  ),
                  const SizedBox(width: 16),
                  _buildSocialAppItem(
                    label: 'Copy link',
                    color: const Color(0xFF2563EB),
                    icon: Icons.link,
                    onTap: _copyLink,
                  ),
                  const SizedBox(width: 16),
                  _buildSocialAppItem(
                    label: 'WhatsApp',
                    color: const Color(0xFF25D366),
                    icon: Icons.chat_bubble_rounded,
                    onTap: _shareViaNative,
                  ),
                  const SizedBox(width: 16),
                  _buildSocialAppItem(
                    label: 'Status',
                    color: const Color(0xFF10B981),
                    icon: Icons.donut_large_rounded,
                    onTap: _shareViaNative,
                  ),
                  const SizedBox(width: 16),
                  _buildSocialAppItem(
                    label: 'Facebook',
                    color: const Color(0xFF1877F2),
                    icon: Icons.facebook,
                    onTap: _shareViaNative,
                  ),
                  const SizedBox(width: 16),
                  _buildSocialAppItem(
                    label: 'More',
                    color: const Color(0xFF6366F1),
                    icon: Icons.more_horiz,
                    onTap: _shareViaNative,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            Divider(height: 1, color: Colors.grey.shade200),
            const SizedBox(height: 14),

            // ROW 3: Circular post actions (About this ad, Report, Not interested, Download, Create group, Save)
            SizedBox(
              height: 84,
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                scrollDirection: Axis.horizontal,
                children: [
                  _buildActionItem(
                    label: 'About this ad',
                    icon: Icons.help_outline,
                    onTap: () {
                      Navigator.pop(context);
                      showDialog(
                        context: context,
                        builder: (_) => AlertDialog(
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          title: const Text('About This Story'),
                          content: Text(
                            widget.sourceName != null && widget.sourceName!.isNotEmpty
                                ? 'Published by ${widget.sourceName} on NewsShare.'
                                : 'Published on NewsShare decentralized news feed.',
                          ),
                          actions: [
                            TextButton(
                              onPressed: () => Navigator.pop(context),
                              child: const Text('Close'),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                  const SizedBox(width: 16),
                  if (!isOwn) ...[
                    _buildActionItem(
                      label: 'Report',
                      icon: Icons.warning_amber_rounded,
                      iconColor: const Color(0xFFFE2C55),
                      onTap: _handleReport,
                    ),
                    const SizedBox(width: 16),
                    _buildActionItem(
                      label: 'Not interested',
                      icon: Icons.heart_broken_rounded,
                      onTap: _handleNotInterested,
                    ),
                    const SizedBox(width: 16),
                  ],
                  _buildActionItem(
                    label: 'Download',
                    icon: Icons.download_rounded,
                    onTap: () {
                      Navigator.pop(context);
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Post saved to device downloads'),
                          behavior: SnackBarBehavior.floating,
                        ),
                      );
                    },
                  ),
                  const SizedBox(width: 16),
                  _buildActionItem(
                    label: 'Create group',
                    icon: Icons.group_add_outlined,
                    onTap: () {
                      Navigator.pop(context);
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Group discussion feature coming soon'),
                          behavior: SnackBarBehavior.floating,
                        ),
                      );
                    },
                  ),
                  const SizedBox(width: 16),
                  _buildActionItem(
                    label: _savedState ? 'Saved' : 'Save',
                    icon: _savedState ? Icons.bookmark : Icons.bookmark_border,
                    iconColor: _savedState ? const Color(0xFF2563EB) : Colors.black87,
                    onTap: () {
                      _handleSaveToggle();
                    },
                  ),
                  if (isOwn) ...[
                    if (widget.onEdit != null) ...[
                      const SizedBox(width: 16),
                      _buildActionItem(
                        label: 'Edit',
                        icon: Icons.edit_outlined,
                        iconColor: Colors.blue,
                        onTap: () {
                          Navigator.pop(context);
                          widget.onEdit?.call();
                        },
                      ),
                    ],
                    if (widget.onDelete != null) ...[
                      const SizedBox(width: 16),
                      _buildActionItem(
                        label: 'Delete',
                        icon: Icons.delete_outline,
                        iconColor: Colors.red,
                        onTap: () {
                          Navigator.pop(context);
                          widget.onDelete?.call();
                        },
                      ),
                    ],
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAvatarFallback(String name) {
    final initial = name.isNotEmpty ? name[0].toUpperCase() : '?';
    return Center(
      child: Text(
        initial,
        style: TextStyle(
          color: Colors.grey.shade700,
          fontWeight: FontWeight.bold,
          fontSize: 20,
        ),
      ),
    );
  }

  Widget _buildSocialAppItem({
    required String label,
    required Color color,
    required IconData icon,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: SizedBox(
        width: 62,
        child: Column(
          children: [
            Container(
              width: 50,
              height: 50,
              decoration: BoxDecoration(
                color: color,
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: Colors.white, size: 26),
            ),
            const SizedBox(height: 6),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 11.5, color: Colors.black87),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActionItem({
    required String label,
    required IconData icon,
    Color iconColor = Colors.black87,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: SizedBox(
        width: 68,
        child: Column(
          children: [
            Container(
              width: 50,
              height: 50,
              decoration: BoxDecoration(
                color: Colors.grey.shade100,
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: iconColor, size: 24),
            ),
            const SizedBox(height: 6),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 11, color: Colors.black87),
            ),
          ],
        ),
      ),
    );
  }
}
