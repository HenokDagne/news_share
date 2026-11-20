import 'package:flutter/material.dart';
import '../../services/api_client.dart';

class CommentsSheet extends StatefulWidget {
  final String postId;
  final int initialCount;
  final ValueChanged<int>? onCountChanged;

  const CommentsSheet({
    super.key,
    required this.postId,
    this.initialCount = 0,
    this.onCountChanged,
  });

  static Future<void> show(
    BuildContext context, {
    required String postId,
    int initialCount = 0,
    ValueChanged<int>? onCountChanged,
  }) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => CommentsSheet(
        postId: postId,
        initialCount: initialCount,
        onCountChanged: onCountChanged,
      ),
    );
  }

  @override
  State<CommentsSheet> createState() => _CommentsSheetState();
}

class _CommentsSheetState extends State<CommentsSheet> {
  final TextEditingController _commentController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  List<Map<String, dynamic>> _comments = [];
  bool _isLoading = true;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _loadComments();
  }

  @override
  void dispose() {
    _commentController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _loadComments() async {
    try {
      final list = await ApiClient.instance.getComments(widget.postId);
      if (mounted) {
        setState(() {
          _comments = list;
          _isLoading = false;
        });
        widget.onCountChanged?.call(_comments.length);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _submitComment() async {
    final text = _commentController.text.trim();
    if (text.isEmpty || _isSubmitting) return;

    if (!ApiClient.instance.isAuthenticated) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please log in to comment'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    setState(() => _isSubmitting = true);
    final user = ApiClient.instance.currentUser;
    final optimisticComment = {
      'id': 'temp-${DateTime.now().millisecondsSinceEpoch}',
      'content': text,
      'createdAt': DateTime.now().toIso8601String(),
      'author': {
        'id': user?.id ?? '',
        'username': user?.username ?? 'me',
        'fullName': user?.fullName ?? user?.username ?? 'Me',
        'avatarUrl': user?.avatarUrl,
      },
    };

    setState(() {
      _comments.add(optimisticComment);
    });
    _commentController.clear();
    widget.onCountChanged?.call(_comments.length);

    // Scroll to bottom
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });

    try {
      final created = await ApiClient.instance.addComment(widget.postId, text);
      if (mounted) {
        setState(() {
          final idx = _comments.indexOf(optimisticComment);
          if (idx != -1 && created.isNotEmpty) {
            _comments[idx] = created;
          }
          _isSubmitting = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _comments.remove(optimisticComment);
          _isSubmitting = false;
        });
        widget.onCountChanged?.call(_comments.length);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to post comment: $e'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  String _formatTime(String? raw) {
    if (raw == null || raw.isEmpty) return 'now';
    try {
      final dt = DateTime.tryParse(raw);
      if (dt != null) {
        final diff = DateTime.now().toUtc().difference(dt.toUtc());
        if (diff.inSeconds < 60) return 'Just now';
        if (diff.inMinutes < 60) return '${diff.inMinutes}m';
        if (diff.inHours < 24) return '${diff.inHours}h';
        if (diff.inDays < 7) return '${diff.inDays}d';
        return '${dt.toLocal()}'.split(' ')[0];
      }
    } catch (_) {}
    return '';
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    final screenHeight = MediaQuery.of(context).size.height;

    return Container(
      constraints: BoxConstraints(
        maxHeight: screenHeight * 0.75,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.only(bottom: bottomInset),
      child: SafeArea(
        top: false,
        child: Column(
          children: [
            // Drag handle
            const SizedBox(height: 10),
            Center(
              child: Container(
                height: 4,
                width: 36,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),

            // Header
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  const SizedBox(width: 32),
                  Expanded(
                    child: Text(
                      '${_comments.length} comments',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.bold,
                        color: Colors.black,
                      ),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, color: Colors.black87, size: 22),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),

            // Comments List
            Expanded(
              child: _isLoading
                  ? const Center(
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : _comments.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.chat_bubble_outline, size: 54, color: Colors.grey.shade300),
                              const SizedBox(height: 12),
                              Text(
                                'No comments yet',
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: Colors.grey.shade700,
                                  fontSize: 15,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'Be the first to share what you think!',
                                style: TextStyle(
                                  color: Colors.grey.shade500,
                                  fontSize: 13,
                                ),
                              ),
                            ],
                          ),
                        )
                      : ListView.separated(
                          controller: _scrollController,
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                          itemCount: _comments.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 16),
                          itemBuilder: (context, index) {
                            final c = _comments[index];
                            final author = c['author'] is Map ? c['author'] as Map : {};
                            final authorName = (author['fullName'] ?? author['username'] ?? 'User').toString();
                            final avatarUrl = author['avatarUrl']?.toString();
                            final content = c['content']?.toString() ?? '';
                            final time = _formatTime(c['createdAt']?.toString());

                            return Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                // Avatar
                                CircleAvatar(
                                  radius: 17,
                                  backgroundColor: Colors.grey.shade200,
                                  backgroundImage: (avatarUrl != null && avatarUrl.startsWith('http'))
                                      ? NetworkImage(avatarUrl)
                                      : null,
                                  child: (avatarUrl == null || !avatarUrl.startsWith('http'))
                                      ? Text(
                                          authorName.isNotEmpty ? authorName[0].toUpperCase() : 'U',
                                          style: TextStyle(
                                            color: Colors.grey.shade700,
                                            fontWeight: FontWeight.bold,
                                            fontSize: 14,
                                          ),
                                        )
                                      : null,
                                ),
                                const SizedBox(width: 12),

                                // Comment body
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Text(
                                            authorName,
                                            style: const TextStyle(
                                              fontWeight: FontWeight.w600,
                                              fontSize: 13,
                                              color: Colors.black87,
                                            ),
                                          ),
                                          const SizedBox(width: 6),
                                          Text(
                                            time,
                                            style: TextStyle(
                                              fontSize: 11.5,
                                              color: Colors.grey.shade500,
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        content,
                                        style: const TextStyle(
                                          fontSize: 14,
                                          color: Colors.black87,
                                          height: 1.25,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),

                                // Like icon
                                IconButton(
                                  icon: const Icon(Icons.favorite_border, size: 16, color: Colors.grey),
                                  onPressed: () {},
                                  constraints: const BoxConstraints(),
                                  padding: EdgeInsets.zero,
                                ),
                              ],
                            );
                          },
                        ),
            ),
            const Divider(height: 1),

            // Input Bar
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 17,
                    backgroundColor: Colors.grey.shade200,
                    backgroundImage: ApiClient.instance.currentUser?.avatarUrl != null
                        ? NetworkImage(ApiClient.instance.currentUser!.avatarUrl!)
                        : null,
                    child: ApiClient.instance.currentUser?.avatarUrl == null
                        ? const Icon(Icons.person, size: 20, color: Colors.grey)
                        : null,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      decoration: BoxDecoration(
                        color: Colors.grey.shade100,
                        borderRadius: BorderRadius.circular(24),
                      ),
                      child: TextField(
                        controller: _commentController,
                        textInputAction: TextInputAction.send,
                        onSubmitted: (_) => _submitComment(),
                        decoration: const InputDecoration(
                          hintText: 'Add a comment...',
                          hintStyle: TextStyle(fontSize: 13.5, color: Colors.grey),
                          border: InputBorder.none,
                          isDense: true,
                          contentPadding: EdgeInsets.symmetric(vertical: 10),
                        ),
                        style: const TextStyle(fontSize: 14),
                      ),
                    ),
                  ),
                  const SizedBox(width: 6),
                  IconButton(
                    icon: _isSubmitting
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.send_rounded, color: Color(0xFFFE2C55), size: 24),
                    onPressed: _submitComment,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
