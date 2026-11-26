import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../../services/api_client.dart';
import '../../services/camera/camera_service.dart';
import '../../services/camera/camera_service_locator.dart';
import '../profile/profile_page.dart';

class ChatScreen extends StatefulWidget {
  final String conversationId;
  final Map<String, dynamic> recipientProfile;

  const ChatScreen({
    super.key,
    required this.conversationId,
    required this.recipientProfile,
  });

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final TextEditingController _textController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  List<Map<String, dynamic>> _messages = [];
  bool _isLoading = true;
  bool _isSending = false;
  bool _isUploadingAttachment = false;
  bool _isLoadingOlder = false;
  String? _nextCursor;
  Timer? _pollingTimer;

  String get _recipientId => widget.recipientProfile['id']?.toString() ?? '';
  String get _recipientUsername => widget.recipientProfile['username']?.toString() ?? 'User';
  String get _recipientFullName => widget.recipientProfile['fullName']?.toString() ?? _recipientUsername;
  String? get _recipientAvatarUrl => widget.recipientProfile['avatarUrl']?.toString();
  bool get _isRecipientOnline => widget.recipientProfile['isOnline'] == true;

  @override
  void initState() {
    super.initState();
    initCameraService();
    _fetchMessages();
    _markRead();

    // Scroll listener for cursor pagination (pull older messages)
    _scrollController.addListener(() {
      if (_scrollController.position.pixels <= 40 &&
          !_isLoadingOlder &&
          _nextCursor != null) {
        _loadOlderMessages();
      }
    });

    // Real-time polling timer every 2 seconds
    _pollingTimer = Timer.periodic(const Duration(seconds: 2), (_) {
      _fetchMessages(silent: true);
    });
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    _textController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _markRead() async {
    try {
      await ApiClient.instance.markConversationRead(widget.conversationId);
    } catch (_) {}
  }

  Future<void> _fetchMessages({bool silent = false}) async {
    if (!silent) setState(() => _isLoading = true);
    try {
      final res = await ApiClient.instance.getMessages(widget.conversationId, limit: 40);
      if (mounted) {
        final list = res['messages'] as List<Map<String, dynamic>>;
        final hadNewMessages = list.length != _messages.length;
        setState(() {
          _messages = list;
          _nextCursor = res['nextCursor'] as String?;
          _isLoading = false;
        });

        if (hadNewMessages) {
          _markRead();
          _scrollToBottom();
        }
      }
    } catch (e) {
      debugPrint('Error fetching messages: $e');
      if (mounted && !silent) setState(() => _isLoading = false);
    }
  }

  Future<void> _loadOlderMessages() async {
    if (_nextCursor == null || _isLoadingOlder) return;
    setState(() => _isLoadingOlder = true);
    try {
      final res = await ApiClient.instance.getMessages(
        widget.conversationId,
        cursor: _nextCursor,
        limit: 30,
      );
      if (mounted) {
        final older = res['messages'] as List<Map<String, dynamic>>;
        setState(() {
          _messages = [...older, ..._messages];
          _nextCursor = res['nextCursor'] as String?;
          _isLoadingOlder = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _isLoadingOlder = false);
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _sendMessage({String? attachmentId, String messageType = 'TEXT'}) async {
    final text = _textController.text.trim();
    if (text.isEmpty && attachmentId == null) return;
    if (_isSending) return;

    _textController.clear();
    setState(() => _isSending = true);

    final idempotencyKey = 'msg_${DateTime.now().millisecondsSinceEpoch}_${text.hashCode}';
    final myId = ApiClient.instance.currentUserId ?? '';
    final tempMsg = {
      'id': 'temp_${DateTime.now().millisecondsSinceEpoch}',
      'conversationId': widget.conversationId,
      'senderId': myId,
      'recipientId': _recipientId,
      'content': text.isNotEmpty ? text : (messageType == 'IMAGE' ? '📷 Image' : '📎 Attachment'),
      'messageType': messageType,
      'isRead': false,
      'isEdited': false,
      'isDeleted': false,
      'createdAt': DateTime.now().toIso8601String(),
      'receipts': [{'status': 'SENT'}],
      'attachments': [],
    };

    setState(() {
      _messages.add(tempMsg);
    });
    _scrollToBottom();

    try {
      final contentToSend = text.isNotEmpty
          ? text
          : (messageType == 'IMAGE' ? '📷 Image' : '📎 Attachment');
      final created = await ApiClient.instance.sendMessage(
        widget.conversationId,
        contentToSend,
        idempotencyKey: idempotencyKey,
        messageType: messageType,
        attachmentIds: attachmentId != null ? [attachmentId] : null,
      );
      if (mounted) {
        setState(() {
          final idx = _messages.indexWhere((m) => m['id'] == tempMsg['id']);
          if (idx != -1) {
            _messages[idx] = created;
          }
          _isSending = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _messages.removeWhere((m) => m['id'] == tempMsg['id']);
          _isSending = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to send message: $e'),
            backgroundColor: const Color(0xFFEF4444),
          ),
        );
      }
    }
  }

  String _getMimeType(String filename) {
    final ext = filename.split('.').last.toLowerCase();
    switch (ext) {
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      case 'gif':
        return 'image/gif';
      case 'pdf':
        return 'application/pdf';
      case 'txt':
        return 'text/plain';
      case 'doc':
        return 'application/msword';
      case 'docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case 'jpg':
      case 'jpeg':
      default:
        return 'image/jpeg';
    }
  }

  void _showAttachmentOptions() {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1E222B),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Wrap(
          children: [
            Container(
              alignment: Alignment.center,
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.white24,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            ListTile(
              leading: const Icon(Icons.camera_alt_outlined, color: Color(0xFF818CF8)),
              title: const Text('Take photo with camera', style: TextStyle(color: Colors.white)),
              onTap: () {
                Navigator.pop(ctx);
                _pickAndUploadCamera();
              },
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined, color: Color(0xFF38BDF8)),
              title: const Text('Choose photo from gallery', style: TextStyle(color: Colors.white)),
              onTap: () {
                Navigator.pop(ctx);
                _pickAndUploadGallery();
              },
            ),
            ListTile(
              leading: const Icon(Icons.attach_file_rounded, color: Color(0xFF10B981)),
              title: const Text('Attach media or file', style: TextStyle(color: Colors.white)),
              onTap: () {
                Navigator.pop(ctx);
                _pickAndUploadMedia();
              },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _pickAndUploadCamera() async {
    try {
      initCameraService();
      final result = await CameraService.instance.capturePhoto(context);
      if (!result.success || result.imagePath == null) {
        if (!result.canceled && result.errorMessage != null && mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(result.errorMessage!), backgroundColor: const Color(0xFFEF4444)),
          );
        }
        return;
      }
      final file = File(result.imagePath!);
      final bytes = await file.readAsBytes();
      final filename = result.imagePath!.split(Platform.pathSeparator).last;
      await _uploadAndSendBytes(bytes, filename, 'image/jpeg', messageType: 'IMAGE');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Camera error: $e'), backgroundColor: const Color(0xFFEF4444)),
        );
      }
    }
  }

  Future<void> _pickAndUploadGallery() async {
    try {
      final picker = ImagePicker();
      final picked = await picker.pickImage(
        source: ImageSource.gallery,
        maxWidth: 1600,
        maxHeight: 1600,
        imageQuality: 85,
      );
      if (picked == null) return;
      final bytes = await picked.readAsBytes();
      final filename = picked.name.isNotEmpty ? picked.name : 'photo_${DateTime.now().millisecondsSinceEpoch}.jpg';
      final mimeType = _getMimeType(filename);
      await _uploadAndSendBytes(bytes, filename, mimeType, messageType: 'IMAGE');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Gallery error: $e'), backgroundColor: const Color(0xFFEF4444)),
        );
      }
    }
  }

  Future<void> _pickAndUploadMedia() async {
    try {
      final picker = ImagePicker();
      final picked = await picker.pickMedia(
        maxWidth: 1600,
        maxHeight: 1600,
        imageQuality: 85,
      );
      if (picked == null) return;
      final bytes = await picked.readAsBytes();
      final filename = picked.name.isNotEmpty ? picked.name : 'media_${DateTime.now().millisecondsSinceEpoch}';
      final mimeType = _getMimeType(filename);
      final isImage = mimeType.startsWith('image/');
      await _uploadAndSendBytes(bytes, filename, mimeType, messageType: isImage ? 'IMAGE' : 'FILE');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Media selection error: $e'), backgroundColor: const Color(0xFFEF4444)),
        );
      }
    }
  }

  Future<void> _uploadAndSendBytes(
    List<int> bytes,
    String filename,
    String mimeType, {
    String messageType = 'IMAGE',
  }) async {
    setState(() => _isUploadingAttachment = true);
    try {
      final att = await ApiClient.instance.uploadAttachmentToCloudinary(
        conversationId: widget.conversationId,
        fileOrBytes: bytes,
        filename: filename,
        mimeType: mimeType,
      );

      setState(() => _isUploadingAttachment = false);
      await _sendMessage(attachmentId: att['id'] as String, messageType: messageType);
    } catch (e) {
      if (mounted) {
        setState(() => _isUploadingAttachment = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Attachment upload failed: $e'), backgroundColor: const Color(0xFFEF4444)),
        );
      }
    }
  }

  void _showMessageOptions(Map<String, dynamic> msg, bool isMe) {
    if (!isMe || msg['isDeleted'] == true) return;

    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1E222B),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => SafeArea(
        child: Wrap(
          children: [
            if (msg['messageType'] == 'TEXT')
              ListTile(
                leading: const Icon(Icons.edit_outlined, color: Colors.white),
                title: const Text('Edit message', style: TextStyle(color: Colors.white)),
                onTap: () {
                  Navigator.pop(ctx);
                  _showEditDialog(msg);
                },
              ),
            ListTile(
              leading: const Icon(Icons.delete_outline, color: Color(0xFFEF4444)),
              title: const Text('Delete message', style: TextStyle(color: Color(0xFFEF4444))),
              onTap: () {
                Navigator.pop(ctx);
                _confirmDeleteMessage(msg);
              },
            ),
          ],
        ),
      ),
    );
  }

  void _showEditDialog(Map<String, dynamic> msg) {
    final editController = TextEditingController(text: msg['content']?.toString() ?? '');
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E222B),
        title: const Text('Edit Message', style: TextStyle(color: Colors.white)),
        content: TextField(
          controller: editController,
          autofocus: true,
          style: const TextStyle(color: Colors.white),
          decoration: const InputDecoration(
            hintText: 'Enter new message...',
            hintStyle: TextStyle(color: Colors.white38),
            enabledBorder: UnderlineInputBorder(borderSide: BorderSide(color: Color(0xFF4F46E5))),
            focusedBorder: UnderlineInputBorder(borderSide: BorderSide(color: Color(0xFF6366F1), width: 2)),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel', style: TextStyle(color: Colors.white54)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF4F46E5)),
            onPressed: () async {
              final newContent = editController.text.trim();
              if (newContent.isEmpty) return;
              Navigator.pop(ctx);
              try {
                final updated = await ApiClient.instance.editMessage(msg['id'].toString(), newContent);
                if (mounted) {
                  setState(() {
                    final idx = _messages.indexWhere((m) => m['id'] == msg['id']);
                    if (idx != -1) _messages[idx] = updated;
                  });
                }
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Failed to edit: $e'), backgroundColor: const Color(0xFFEF4444)),
                  );
                }
              }
            },
            child: const Text('Save', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  void _confirmDeleteMessage(Map<String, dynamic> msg) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E222B),
        title: const Text('Delete Message', style: TextStyle(color: Colors.white)),
        content: const Text(
          'Are you sure you want to delete this message? This action cannot be undone.',
          style: TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel', style: TextStyle(color: Colors.white54)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFEF4444)),
            onPressed: () async {
              Navigator.pop(ctx);
              try {
                await ApiClient.instance.deleteMessage(msg['id'].toString());
                if (mounted) {
                  setState(() {
                    final idx = _messages.indexWhere((m) => m['id'] == msg['id']);
                    if (idx != -1) {
                      _messages[idx]['isDeleted'] = true;
                      _messages[idx]['content'] = '[Message deleted]';
                    }
                  });
                }
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Failed to delete: $e'), backgroundColor: const Color(0xFFEF4444)),
                  );
                }
              }
            },
            child: const Text('Delete', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  String _formatMessageTime(dynamic raw) {
    if (raw == null) return '';
    try {
      final dt = DateTime.parse(raw.toString()).toLocal();
      final hour = dt.hour % 12 == 0 ? 12 : dt.hour % 12;
      final minute = dt.minute.toString().padLeft(2, '0');
      final ampm = dt.hour >= 12 ? 'PM' : 'AM';
      return '$hour:$minute $ampm';
    } catch (_) {
      return '';
    }
  }

  @override
  Widget build(BuildContext context) {
    final myId = ApiClient.instance.currentUserId;

    return Scaffold(
      backgroundColor: const Color(0xFF0F1115),
      appBar: AppBar(
        backgroundColor: const Color(0xFF14171F),
        elevation: 0.5,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: Colors.white, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        titleSpacing: 0,
        title: GestureDetector(
          onTap: () {
            if (_recipientId.isNotEmpty) {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => ProfilePage(userId: _recipientId)),
              );
            }
          },
          child: Row(
            children: [
              Stack(
                children: [
                  CircleAvatar(
                    radius: 18,
                    backgroundColor: const Color(0xFF262A34),
                    backgroundImage: (_recipientAvatarUrl != null && _recipientAvatarUrl!.isNotEmpty)
                        ? NetworkImage(_recipientAvatarUrl!)
                        : null,
                    child: (_recipientAvatarUrl == null || _recipientAvatarUrl!.isEmpty)
                        ? Text(
                            _recipientUsername.isNotEmpty ? _recipientUsername[0].toUpperCase() : '?',
                            style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold),
                          )
                        : null,
                  ),
                  if (_isRecipientOnline)
                    Positioned(
                      bottom: 0,
                      right: 0,
                      child: Container(
                        width: 10,
                        height: 10,
                        decoration: BoxDecoration(
                          color: const Color(0xFF10B981),
                          shape: BoxShape.circle,
                          border: Border.all(color: const Color(0xFF14171F), width: 1.5),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _recipientFullName.isNotEmpty ? _recipientFullName : _recipientUsername,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    Text(
                      _isRecipientOnline ? 'Active now' : '@$_recipientUsername',
                      style: TextStyle(
                        color: _isRecipientOnline ? const Color(0xFF10B981) : Colors.white54,
                        fontSize: 11,
                        fontWeight: _isRecipientOnline ? FontWeight.w600 : FontWeight.normal,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            if (_isLoadingOlder)
              const LinearProgressIndicator(
                backgroundColor: Color(0xFF14171F),
                color: Color(0xFF4F46E5),
                minHeight: 2,
              ),

            // Messages Scroll Area
            Expanded(
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator(color: Color(0xFF4F46E5)))
                  : _messages.isEmpty
                      ? _buildEmptyChat()
                      : ListView.builder(
                          controller: _scrollController,
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                          itemCount: _messages.length,
                          itemBuilder: (context, index) {
                            final msg = _messages[index];
                            final isMe = msg['senderId'] == myId;
                            final isRead = msg['isRead'] == true;
                            final isEdited = msg['isEdited'] == true;
                            final isDeleted = msg['isDeleted'] == true;
                            final timeStr = _formatMessageTime(msg['createdAt']);

                            return GestureDetector(
                              onLongPress: () => _showMessageOptions(msg, isMe),
                              child: _buildMessageBubble(
                                msg: msg,
                                content: msg['content']?.toString() ?? '',
                                isMe: isMe,
                                isRead: isRead,
                                isEdited: isEdited,
                                isDeleted: isDeleted,
                                time: timeStr,
                              ),
                            );
                          },
                        ),
            ),

            if (_isUploadingAttachment)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                color: const Color(0xFF1E222B),
                child: const Row(
                  children: [
                    SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF38BDF8))),
                    SizedBox(width: 12),
                    Text('Uploading attachment to Cloudinary...', style: TextStyle(color: Colors.white70, fontSize: 12)),
                  ],
                ),
              ),

            // Input Bar
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: const BoxDecoration(
                color: Color(0xFF14171F),
                border: Border(top: BorderSide(color: Color(0xFF1F2430), width: 1)),
              ),
              child: Row(
                children: [
                  // Attachment options button (+)
                  GestureDetector(
                    onTap: _showAttachmentOptions,
                    child: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: const BoxDecoration(
                        color: Color(0xFF1E222B),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.add,
                        color: Colors.white,
                        size: 20,
                      ),
                    ),
                  ),
                  const SizedBox(width: 6),

                  // Camera quick button
                  GestureDetector(
                    onTap: _pickAndUploadCamera,
                    child: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: const BoxDecoration(
                        color: Color(0xFF1E222B),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.camera_alt_outlined,
                        color: Color(0xFF818CF8),
                        size: 19,
                      ),
                    ),
                  ),
                  const SizedBox(width: 6),

                  // Photo gallery quick button
                  GestureDetector(
                    onTap: _pickAndUploadGallery,
                    child: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: const BoxDecoration(
                        color: Color(0xFF1E222B),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.photo_library_outlined,
                        color: Color(0xFF38BDF8),
                        size: 19,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),

                  Expanded(
                    child: Container(
                      decoration: BoxDecoration(
                        color: const Color(0xFF1E222B),
                        borderRadius: BorderRadius.circular(24),
                        border: Border.all(color: const Color(0xFF2B303D), width: 1),
                      ),
                      child: TextField(
                        controller: _textController,
                        style: const TextStyle(color: Colors.white, fontSize: 14),
                        maxLines: 4,
                        minLines: 1,
                        textCapitalization: TextCapitalization.sentences,
                        decoration: const InputDecoration(
                          hintText: 'Message...',
                          hintStyle: TextStyle(color: Colors.white38, fontSize: 14),
                          border: InputBorder.none,
                          contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                        ),
                        onSubmitted: (_) => _sendMessage(),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: _sendMessage,
                    child: Container(
                      padding: const EdgeInsets.all(10),
                      decoration: const BoxDecoration(
                        color: Color(0xFF4F46E5),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.send_rounded,
                        color: Colors.white,
                        size: 20,
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

  Widget _buildMessageBubble({
    required Map<String, dynamic> msg,
    required String content,
    required bool isMe,
    required bool isRead,
    required bool isEdited,
    required bool isDeleted,
    required String time,
  }) {
    final attachments = (msg['attachments'] as List?) ?? [];

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Column(
        crossAxisAlignment: isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
        children: [
          Container(
            constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
            decoration: BoxDecoration(
              color: isDeleted
                  ? const Color(0xFF181B22)
                  : (isMe ? const Color(0xFF4F46E5) : const Color(0xFF1E222B)),
              borderRadius: BorderRadius.only(
                topLeft: const Radius.circular(16),
                topRight: const Radius.circular(16),
                bottomLeft: Radius.circular(isMe ? 16 : 4),
                bottomRight: Radius.circular(isMe ? 4 : 16),
              ),
              border: Border.all(
                color: isDeleted
                    ? Colors.white12
                    : (isMe ? const Color(0xFF6366F1) : const Color(0xFF2B303D)),
                width: 0.7,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Render attachments if present
                for (final att in attachments)
                  if (att['url'] != null)
                    (att['resourceType'] == 'image' || att['mimeType']?.toString().startsWith('image/') == true)
                        ? Padding(
                            padding: const EdgeInsets.only(bottom: 6),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(10),
                              child: Image.network(
                                att['url'] as String,
                                fit: BoxFit.cover,
                                errorBuilder: (_, __, ___) => const Icon(Icons.broken_image, color: Colors.white54),
                              ),
                            ),
                          )
                        : Container(
                            margin: const EdgeInsets.only(bottom: 6),
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                            decoration: BoxDecoration(
                              color: Colors.black26,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: Colors.white24, width: 0.5),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.insert_drive_file_outlined, color: Color(0xFF38BDF8), size: 24),
                                const SizedBox(width: 8),
                                Flexible(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        att['originalFilename']?.toString() ?? 'Attachment',
                                        style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                      if (att['bytes'] != null)
                                        Text(
                                          '${((att['bytes'] as num) / 1024).toStringAsFixed(1)} KB',
                                          style: const TextStyle(color: Colors.white54, fontSize: 10),
                                        ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),

                Text(
                  content,
                  style: TextStyle(
                    color: isDeleted ? Colors.white38 : Colors.white,
                    fontStyle: isDeleted ? FontStyle.italic : FontStyle.normal,
                    fontSize: 14,
                    height: 1.35,
                  ),
                ),
                const SizedBox(height: 3),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    if (isEdited && !isDeleted)
                      const Text(
                        'edited ',
                        style: TextStyle(color: Colors.white38, fontSize: 10, fontStyle: FontStyle.italic),
                      ),
                    Text(
                      time,
                      style: const TextStyle(color: Colors.white38, fontSize: 10),
                    ),
                    if (isMe && !isDeleted) ...[
                      const SizedBox(width: 4),
                      Icon(
                        isRead ? Icons.done_all : Icons.done,
                        size: 13,
                        color: isRead ? const Color(0xFF38BDF8) : Colors.white38,
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyChat() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          CircleAvatar(
            radius: 36,
            backgroundColor: const Color(0xFF1E222B),
            backgroundImage: (_recipientAvatarUrl != null && _recipientAvatarUrl!.isNotEmpty)
                ? NetworkImage(_recipientAvatarUrl!)
                : null,
            child: (_recipientAvatarUrl == null || _recipientAvatarUrl!.isEmpty)
                ? Text(
                    _recipientUsername.isNotEmpty ? _recipientUsername[0].toUpperCase() : '?',
                    style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold),
                  )
                : null,
          ),
          const SizedBox(height: 14),
          Text(
            _recipientFullName.isNotEmpty ? _recipientFullName : _recipientUsername,
            style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 4),
          Text(
            '@$_recipientUsername',
            style: const TextStyle(color: Colors.white54, fontSize: 13),
          ),
          const SizedBox(height: 18),
          const Text(
            'No messages yet. Say hello!',
            style: TextStyle(color: Colors.white38, fontSize: 13),
          ),
        ],
      ),
    );
  }
}
