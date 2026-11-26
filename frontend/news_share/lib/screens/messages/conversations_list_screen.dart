import 'dart:async';
import 'package:flutter/material.dart';
import '../../services/api_client.dart';
import 'chat_screen.dart';
import '../profile/profile_page.dart';

class ConversationsListScreen extends StatefulWidget {
  const ConversationsListScreen({super.key});

  @override
  State<ConversationsListScreen> createState() => _ConversationsListScreenState();
}

class _ConversationsListScreenState extends State<ConversationsListScreen> {
  List<Map<String, dynamic>> _conversations = [];
  bool _isLoading = true;
  String _searchQuery = '';
  Timer? _pollingTimer;

  @override
  void initState() {
    super.initState();
    _loadConversations();
    // Poll for real-time conversation updates every 3 seconds
    _pollingTimer = Timer.periodic(const Duration(seconds: 3), (_) {
      _loadConversations(silent: true);
    });
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    super.dispose();
  }

  Future<void> _loadConversations({bool silent = false}) async {
    if (!silent) setState(() => _isLoading = true);
    try {
      final list = await ApiClient.instance.getConversations();
      if (mounted) {
        setState(() {
          _conversations = list;
          _isLoading = false;
        });
      }
    } catch (e) {
      debugPrint('Error loading conversations: $e');
      if (mounted && !silent) {
        setState(() => _isLoading = false);
      }
    }
  }

  String _formatTime(dynamic raw) {
    if (raw == null) return '';
    try {
      final dt = DateTime.parse(raw.toString()).toLocal();
      final diff = DateTime.now().difference(dt);
      if (diff.inMinutes < 1) return 'now';
      if (diff.inMinutes < 60) return '${diff.inMinutes}m';
      if (diff.inHours < 24) return '${diff.inHours}h';
      if (diff.inDays < 7) return '${diff.inDays}d';
      return '${dt.month}/${dt.day}';
    } catch (_) {
      return '';
    }
  }

  void _showNewMessageSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF181B22),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetContext) {
        return _NewMessageSheet(
          onUserSelected: (targetUser) async {
            Navigator.pop(sheetContext);
            final targetId = targetUser['id']?.toString();
            if (targetId == null) return;

            try {
              final conv = await ApiClient.instance.getOrCreateConversation(targetId);
              if (!mounted) return;
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => ChatScreen(
                    conversationId: conv['id'].toString(),
                    recipientProfile: conv['participant'] ?? targetUser,
                  ),
                ),
              ).then((_) => _loadConversations());
            } catch (e) {
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('Cannot message user: $e'),
                    backgroundColor: const Color(0xFFEF4444),
                  ),
                );
              }
            }
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _conversations.where((conv) {
      if (_searchQuery.isEmpty) return true;
      final p = conv['participant'] as Map<String, dynamic>? ?? {};
      final username = (p['username'] ?? '').toString().toLowerCase();
      final fullName = (p['fullName'] ?? '').toString().toLowerCase();
      final q = _searchQuery.toLowerCase();
      return username.contains(q) || fullName.contains(q);
    }).toList();

    return Scaffold(
      backgroundColor: const Color(0xFF0F1115),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0F1115),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: Colors.white, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          ApiClient.instance.currentUsername ?? 'Messages',
          style: const TextStyle(
            color: Colors.white,
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.edit_square, color: Colors.white, size: 22),
            tooltip: 'New message',
            onPressed: _showNewMessageSheet,
          ),
        ],
      ),
      body: Column(
        children: [
          // Search Bar
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Container(
              height: 40,
              decoration: BoxDecoration(
                color: const Color(0xFF1E222B),
                borderRadius: BorderRadius.circular(10),
              ),
              child: TextField(
                style: const TextStyle(color: Colors.white, fontSize: 14),
                decoration: const InputDecoration(
                  hintText: 'Search direct messages...',
                  hintStyle: TextStyle(color: Colors.white38, fontSize: 14),
                  prefixIcon: Icon(Icons.search, color: Colors.white38, size: 20),
                  border: InputBorder.none,
                  contentPadding: EdgeInsets.symmetric(vertical: 10),
                ),
                onChanged: (val) {
                  setState(() => _searchQuery = val.trim());
                },
              ),
            ),
          ),

          // Messages List
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator(color: Color(0xFF4F46E5)))
                : filtered.isEmpty
                    ? _buildEmptyState()
                    : RefreshIndicator(
                        onRefresh: () => _loadConversations(),
                        color: const Color(0xFF4F46E5),
                        child: ListView.separated(
                          itemCount: filtered.length,
                          separatorBuilder: (_, __) => const Divider(
                            height: 1,
                            color: Color(0xFF1F2430),
                            indent: 76,
                          ),
                          itemBuilder: (context, index) {
                            final conv = filtered[index];
                            final p = conv['participant'] as Map<String, dynamic>? ?? {};
                            final lastMsg = conv['lastMessage'] as Map<String, dynamic>?;
                            final unread = (conv['unreadCount'] as num? ?? 0).toInt();

                            final username = p['username']?.toString() ?? 'User';
                            final fullName = p['fullName']?.toString() ?? username;
                            final avatarUrl = p['avatarUrl']?.toString();
                            final previewText = lastMsg != null
                                ? (lastMsg['senderId'] == ApiClient.instance.currentUserId
                                    ? 'You: ${lastMsg['content']}'
                                    : '${lastMsg['content']}')
                                : 'Active conversation';
                            final timeStr = _formatTime(lastMsg?['createdAt'] ?? conv['lastMessageAt']);

                            return ListTile(
                              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                              leading: GestureDetector(
                                onTap: () {
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) => ProfilePage(userId: p['id']?.toString()),
                                    ),
                                  );
                                },
                                child: Stack(
                                  children: [
                                    CircleAvatar(
                                      radius: 26,
                                      backgroundColor: const Color(0xFF262A34),
                                      backgroundImage: (avatarUrl != null && avatarUrl.isNotEmpty)
                                          ? NetworkImage(avatarUrl)
                                          : null,
                                      child: (avatarUrl == null || avatarUrl.isEmpty)
                                          ? Text(
                                              username.isNotEmpty ? username[0].toUpperCase() : '?',
                                              style: const TextStyle(
                                                color: Colors.white,
                                                fontWeight: FontWeight.bold,
                                                fontSize: 18,
                                              ),
                                            )
                                          : null,
                                    ),
                                    if (p['isOnline'] == true)
                                      Positioned(
                                        bottom: 0,
                                        right: 0,
                                        child: Container(
                                          width: 14,
                                          height: 14,
                                          decoration: BoxDecoration(
                                            color: const Color(0xFF10B981),
                                            shape: BoxShape.circle,
                                            border: Border.all(color: const Color(0xFF0F1115), width: 2),
                                          ),
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                              title: Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      fullName.isNotEmpty ? fullName : username,
                                      style: TextStyle(
                                        color: Colors.white,
                                        fontWeight: unread > 0 ? FontWeight.bold : FontWeight.w600,
                                        fontSize: 15,
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                  Text(
                                    timeStr,
                                    style: TextStyle(
                                      color: unread > 0 ? const Color(0xFF38BDF8) : Colors.white38,
                                      fontSize: 12,
                                    ),
                                  ),
                                ],
                              ),
                              subtitle: Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      previewText,
                                      style: TextStyle(
                                        color: unread > 0 ? Colors.white : Colors.white60,
                                        fontWeight: unread > 0 ? FontWeight.w600 : FontWeight.normal,
                                        fontSize: 13,
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                  if (unread > 0)
                                    Container(
                                      margin: const EdgeInsets.only(left: 8),
                                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFF38BDF8),
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                      child: Text(
                                        unread > 99 ? '99+' : '$unread',
                                        style: const TextStyle(
                                          color: Colors.black,
                                          fontSize: 11,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ),
                                ],
                              ),
                              onTap: () async {
                                await Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => ChatScreen(
                                      conversationId: conv['id'].toString(),
                                      recipientProfile: p,
                                    ),
                                  ),
                                );
                                _loadConversations(silent: true);
                              },
                            );
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: const Color(0xFF181B22),
                shape: BoxShape.circle,
                border: Border.all(color: const Color(0xFF262A34), width: 1.5),
              ),
              child: const Icon(
                Icons.send_rounded,
                color: Color(0xFF38BDF8),
                size: 48,
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'Your Messages',
              style: TextStyle(
                color: Colors.white,
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Send private messages and real-time updates to reporters and friends on News Share.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white60, fontSize: 14),
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: _showNewMessageSheet,
              icon: const Icon(Icons.add_comment_outlined, size: 18),
              label: const Text('Send Message'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF4F46E5),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _NewMessageSheet extends StatefulWidget {
  final ValueChanged<Map<String, dynamic>> onUserSelected;

  const _NewMessageSheet({required this.onUserSelected});

  @override
  State<_NewMessageSheet> createState() => _NewMessageSheetState();
}

class _NewMessageSheetState extends State<_NewMessageSheet> {
  final TextEditingController _searchCtrl = TextEditingController();
  List<Map<String, dynamic>> _users = [];
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _loadUsers('');
  }

  Future<void> _loadUsers(String query) async {
    setState(() => _isLoading = true);
    try {
      final myId = ApiClient.instance.currentUserId;
      final results = await ApiClient.instance.getUsers(search: query, limit: 30);
      final filtered = results.where((u) => u['id'] != myId).toList();
      if (mounted) {
        setState(() {
          _users = filtered;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.75,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
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
          const Text(
            'New Message',
            style: TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 12),
          Container(
            height: 40,
            decoration: BoxDecoration(
              color: const Color(0xFF262A34),
              borderRadius: BorderRadius.circular(10),
            ),
            child: TextField(
              controller: _searchCtrl,
              style: const TextStyle(color: Colors.white, fontSize: 14),
              decoration: const InputDecoration(
                hintText: 'Search people to message...',
                hintStyle: TextStyle(color: Colors.white38, fontSize: 14),
                prefixIcon: Icon(Icons.search, color: Colors.white38, size: 20),
                border: InputBorder.none,
                contentPadding: EdgeInsets.symmetric(vertical: 10),
              ),
              onChanged: (val) => _loadUsers(val.trim()),
            ),
          ),
          const SizedBox(height: 12),
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator(color: Color(0xFF4F46E5)))
                : _users.isEmpty
                    ? const Center(
                        child: Text(
                          'No users found',
                          style: TextStyle(color: Colors.white38),
                        ),
                      )
                    : ListView.builder(
                        itemCount: _users.length,
                        itemBuilder: (context, index) {
                          final user = _users[index];
                          final username = user['username']?.toString() ?? 'user';
                          final fullName = user['fullName']?.toString() ?? username;
                          final avatarUrl = user['avatarUrl']?.toString();

                          return ListTile(
                            contentPadding: const EdgeInsets.symmetric(vertical: 4),
                            leading: CircleAvatar(
                              backgroundColor: const Color(0xFF323846),
                              backgroundImage: (avatarUrl != null && avatarUrl.isNotEmpty)
                                  ? NetworkImage(avatarUrl)
                                  : null,
                              child: (avatarUrl == null || avatarUrl.isEmpty)
                                  ? Text(
                                      username.isNotEmpty ? username[0].toUpperCase() : '?',
                                      style: const TextStyle(color: Colors.white),
                                    )
                                  : null,
                            ),
                            title: Text(
                              fullName,
                              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                            ),
                            subtitle: Text(
                              '@$username',
                              style: const TextStyle(color: Colors.white54, fontSize: 12),
                            ),
                            trailing: const Icon(Icons.arrow_forward_ios, color: Colors.white24, size: 14),
                            onTap: () => widget.onUserSelected(user),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }
}
