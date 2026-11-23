import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle;

import '../../services/api_client.dart';
import '../home/home_page.dart';
import 'post_service.dart';

class PostComposerPage extends StatefulWidget {
  final List<String> selectedMediaPaths;

  const PostComposerPage({
    super.key,
    required this.selectedMediaPaths,
  });

  @override
  State<PostComposerPage> createState() => _PostComposerPageState();
}

class _PostComposerPageState extends State<PostComposerPage> {
  final TextEditingController _titleController = TextEditingController();
  final TextEditingController _captionController = TextEditingController();
  bool _isSharing = false;

  @override
  void dispose() {
    _titleController.dispose();
    _captionController.dispose();
    super.dispose();
  }

  Future<void> _sharePost() async {
    final title = _titleController.text.trim();
    final caption = _captionController.text.trim();

    if (title.isEmpty && caption.isEmpty && widget.selectedMediaPaths.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please add a caption, title, or media.')),
      );
      return;
    }

    setState(() => _isSharing = true);

    try {
      final postService = PostService();
      File? imageFile;
      if (widget.selectedMediaPaths.isNotEmpty) {
        final primaryPath = widget.selectedMediaPaths.first;
        if (primaryPath.startsWith('assets/')) {
          final byteData = await rootBundle.load(primaryPath);
          final tempFile = File('${Directory.systemTemp.path}/${primaryPath.split('/').last}');
          await tempFile.writeAsBytes(byteData.buffer.asUint8List());
          imageFile = tempFile;
        } else if (!kIsWeb) {
          imageFile = File(primaryPath);
        }
      }

      final success = await postService.createPost(
        title: title.isNotEmpty ? title : null,
        content: caption.isNotEmpty ? caption : null,
        imageUrl: widget.selectedMediaPaths.isNotEmpty ? widget.selectedMediaPaths.first : null,
        imageFile: imageFile,
      );

      if (!mounted) return;

      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Post published successfully!'),
            backgroundColor: Color(0xFF0095F6),
          ),
        );
        Navigator.pushAndRemoveUntil(
          context,
          MaterialPageRoute(builder: (_) => const HomePage()),
          (route) => false,
        );
      } else {
        final err = postService.lastError ?? 'Failed to publish post';
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: $err'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to share: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isSharing = false);
      }
    }
  }

  Widget _buildMediaThumbnail() {
    if (widget.selectedMediaPaths.isEmpty) {
      return Container(
        width: 72,
        height: 72,
        decoration: BoxDecoration(
          color: Colors.grey.shade900,
          borderRadius: BorderRadius.circular(8),
        ),
        child: const Icon(Icons.image, color: Colors.white54, size: 28),
      );
    }

    final path = widget.selectedMediaPaths.first;
    return Stack(
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: SizedBox(
            width: 72,
            height: 72,
            child: path.startsWith('assets/')
                ? Image.asset(path, fit: BoxFit.cover)
                : (kIsWeb
                    ? Image.network(path, fit: BoxFit.cover)
                    : Image.file(
                        File(path),
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => Container(
                          color: Colors.grey.shade800,
                          child: const Icon(Icons.broken_image, color: Colors.white54),
                        ),
                      )),
          ),
        ),
        if (widget.selectedMediaPaths.length > 1)
          Positioned(
            right: 4,
            bottom: 4,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
              decoration: BoxDecoration(
                color: Colors.black.withOpacity(0.75),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.layers, color: Colors.white, size: 10),
                  const SizedBox(width: 2),
                  Text(
                    '${widget.selectedMediaPaths.length}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgColor = isDark ? Colors.black : Colors.white;
    final textColor = isDark ? Colors.white : Colors.black;

    return Scaffold(
      backgroundColor: bgColor,
      appBar: AppBar(
        backgroundColor: bgColor,
        elevation: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back, color: textColor),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'New post',
          style: TextStyle(
            color: textColor,
            fontWeight: FontWeight.bold,
            fontSize: 18,
          ),
        ),
        centerTitle: false,
        actions: [
          _isSharing
              ? const Center(
                  child: Padding(
                    padding: EdgeInsets.symmetric(horizontal: 16.0),
                    child: SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Color(0xFF0095F6),
                      ),
                    ),
                  ),
                )
              : TextButton(
                  onPressed: _sharePost,
                  child: const Text(
                    'Share',
                    style: TextStyle(
                      color: Color(0xFF0095F6),
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                    ),
                  ),
                ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Top Section: Media Thumbnail + Caption Input (Instagram style)
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildMediaThumbnail(),
                const SizedBox(width: 14),
                Expanded(
                  child: TextField(
                    controller: _captionController,
                    maxLines: 4,
                    style: TextStyle(color: textColor, fontSize: 15),
                    decoration: InputDecoration(
                      hintText: 'Write a caption...',
                      hintStyle: TextStyle(
                        color: isDark ? Colors.grey.shade500 : Colors.grey.shade400,
                        fontSize: 15,
                      ),
                      border: InputBorder.none,
                      contentPadding: EdgeInsets.zero,
                    ),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 16),
            Divider(color: isDark ? Colors.grey.shade900 : Colors.grey.shade200, height: 1),
            const SizedBox(height: 16),

            // Optional News Title field
            Text(
              'Headline / Title (Optional)',
              style: TextStyle(
                color: isDark ? Colors.grey.shade400 : Colors.grey.shade600,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 6),
            TextField(
              controller: _titleController,
              maxLines: 1,
              style: TextStyle(
                color: textColor,
                fontSize: 16,
                fontWeight: FontWeight.w600,
              ),
              decoration: InputDecoration(
                hintText: 'Add an engaging title...',
                hintStyle: TextStyle(
                  color: isDark ? Colors.grey.shade600 : Colors.grey.shade400,
                  fontSize: 15,
                ),
                filled: true,
                fillColor: isDark ? const Color(0xFF16181F) : const Color(0xFFF6F7F9),
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: BorderSide.none,
                ),
              ),
            ),

            const SizedBox(height: 24),
            Divider(color: isDark ? Colors.grey.shade900 : Colors.grey.shade200, height: 1),
            const SizedBox(height: 12),

            // Additional publishing preferences (Instagram options)
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(Icons.location_on_outlined, color: textColor),
              title: Text('Add location', style: TextStyle(color: textColor)),
              trailing: Icon(Icons.chevron_right, color: Colors.grey.shade500),
              onTap: () {},
            ),
            Divider(color: isDark ? Colors.grey.shade900 : Colors.grey.shade200, height: 1),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(Icons.tag_outlined, color: textColor),
              title: Text('Tag people', style: TextStyle(color: textColor)),
              trailing: Icon(Icons.chevron_right, color: Colors.grey.shade500),
              onTap: () {},
            ),
            Divider(color: isDark ? Colors.grey.shade900 : Colors.grey.shade200, height: 1),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(Icons.tune_outlined, color: textColor),
              title: Text('Advanced settings', style: TextStyle(color: textColor)),
              trailing: Icon(Icons.chevron_right, color: Colors.grey.shade500),
              onTap: () {},
            ),
          ],
        ),
      ),
    );
  }
}
