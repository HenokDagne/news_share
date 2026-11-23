/*
  Instagram-style Media Selection and Post Page:
  - Top navigation bar: Close (✕), POST / STORY / REEL tabs, Next button.
  - Automatically scans real images from local machine directories (Pictures, Screenshots, Camera Roll, Downloads, Desktop, etc.).
  - Shows real local images in a 4-column Instagram grid, sorted newest first.
  - Automatically previews the newest real machine image at the top (~33% screen height).
  - Gallery controls: Gallery dropdown (opens file dialog), Select multiple toggle, Camera shortcut.
  - Tapping any thumbnail instantly updates the live preview.
  - Tapping Next advances to PostComposerPage with selected real images.
*/

import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../services/api_client.dart';
import '../../services/camera/camera_service.dart';
import '../../services/camera/camera_service_locator.dart';
import '../home/bottom_nav.dart';
import '../home/home_page.dart';
import '../notification/notification_page.dart';
import '../profile/profile_page.dart';
import '../users/user_list.dart';
import 'post_composer_page.dart';

class PostPage extends StatefulWidget {
  const PostPage({super.key});

  @override
  State<PostPage> createState() => _PostPageState();
}

enum PostTab { post, story, reel }

class _PostPageState extends State<PostPage> {
  final int _navIndex = 2;
  PostTab _activeTab = PostTab.post;
  final ImagePicker _picker = ImagePicker();

  // All real scanned gallery media paths from the machine
  final List<String> _galleryMedia = [];

  // Selected media paths for multi-select
  final List<String> _selectedMedia = [];

  // Currently previewed media path
  String? _activePreviewPath;

  bool _isMultipleMode = false;
  bool _isLoading = false;
  BoxFit _previewFit = BoxFit.contain;

  bool get _isAuthenticated => ApiClient.instance.isAuthenticated;

  @override
  void initState() {
    super.initState();
    initCameraService();
    _loadMachineGallery();
  }

  /// Recursively scans a directory for real image files on the local machine
  Future<void> _scanDirectory(
    Directory dir,
    List<String> discovered, {
    int maxDepth = 4,
    int currentDepth = 0,
    int maxFiles = 200,
  }) async {
    if (currentDepth > maxDepth || discovered.length >= maxFiles) return;

    try {
      if (!await dir.exists()) return;

      final stream = dir.list(followLinks: false);
      await for (final entity in stream.handleError((_) {})) {
        if (discovered.length >= maxFiles) break;

        if (entity is File) {
          final pathLower = entity.path.toLowerCase();
          if (pathLower.endsWith('.jpg') ||
              pathLower.endsWith('.jpeg') ||
              pathLower.endsWith('.png') ||
              pathLower.endsWith('.webp') ||
              pathLower.endsWith('.bmp') ||
              pathLower.endsWith('.gif')) {
            if (!discovered.contains(entity.path)) {
              discovered.add(entity.path);
            }
          }
        } else if (entity is Directory) {
          final dirName = entity.path.split(Platform.pathSeparator).last;
          // Avoid scanning system or hidden folders
          if (!dirName.startsWith('.') &&
              !dirName.toLowerCase().contains('node_modules') &&
              !dirName.toLowerCase().contains('appdata') &&
              !dirName.toLowerCase().contains(r'$recycle.bin')) {
            await _scanDirectory(
              entity,
              discovered,
              maxDepth: maxDepth,
              currentDepth: currentDepth + 1,
              maxFiles: maxFiles,
            );
          }
        }
      }
    } catch (_) {}
  }

  /// Automatically scans the user's machine for real images and populates the gallery
  Future<void> _loadMachineGallery() async {
    setState(() => _isLoading = true);

    final List<String> discovered = [];

    if (!kIsWeb) {
      try {
        final List<String> targetDirs = [];

        if (Platform.isWindows) {
          final userProfile = Platform.environment['USERPROFILE'];
          if (userProfile != null) {
            targetDirs.addAll([
              '$userProfile\\Pictures',
              '$userProfile\\Pictures\\Screenshots',
              '$userProfile\\Pictures\\Camera Roll',
              '$userProfile\\Pictures\\Saved Pictures',
              '$userProfile\\OneDrive\\Pictures',
              '$userProfile\\Downloads',
              '$userProfile\\Desktop',
            ]);
          }
        } else if (Platform.isAndroid) {
          targetDirs.addAll([
            '/storage/emulated/0/DCIM/Camera',
            '/storage/emulated/0/DCIM',
            '/storage/emulated/0/Pictures',
            '/storage/emulated/0/Pictures/Screenshots',
            '/storage/emulated/0/Download',
          ]);
        } else if (Platform.isIOS || Platform.isMacOS) {
          final home = Platform.environment['HOME'];
          if (home != null) {
            targetDirs.addAll([
              '$home/Pictures',
              '$home/Downloads',
              '$home/Desktop',
            ]);
          }
        } else if (Platform.isLinux) {
          final home = Platform.environment['HOME'];
          if (home != null) {
            targetDirs.addAll([
              '$home/Pictures',
              '$home/Downloads',
            ]);
          }
        }

        for (final dirPath in targetDirs) {
          await _scanDirectory(Directory(dirPath), discovered, maxFiles: 150);
          if (discovered.length >= 150) break;
        }

        // Sort by last modified date (newest photos first, like Instagram)
        discovered.sort((a, b) {
          try {
            final aMod = File(a).lastModifiedSync();
            final bMod = File(b).lastModifiedSync();
            return bMod.compareTo(aMod);
          } catch (_) {
            return 0;
          }
        });
      } catch (e) {
        debugPrint('Error scanning machine directories: $e');
      }
    }

    if (mounted) {
      setState(() {
        _galleryMedia.clear();
        _galleryMedia.addAll(discovered);

        if (_galleryMedia.isNotEmpty) {
          _activePreviewPath = _galleryMedia.first;
          _selectedMedia.clear();
          _selectedMedia.add(_galleryMedia.first);
        }
        _isLoading = false;
      });
    }
  }

  Future<void> _pickFromGallery() async {
    try {
      final List<XFile> picked = await _picker.pickMultiImage();
      if (picked.isNotEmpty) {
        setState(() {
          for (final file in picked) {
            if (!_galleryMedia.contains(file.path)) {
              _galleryMedia.insert(0, file.path);
            }
          }
          if (_galleryMedia.isNotEmpty) {
            _activePreviewPath = _galleryMedia.first;
            if (!_selectedMedia.contains(_galleryMedia.first)) {
              _selectedMedia.clear();
              _selectedMedia.add(_galleryMedia.first);
            }
          }
        });
      }
    } catch (e) {
      debugPrint('Error picking images: $e');
    }
  }

  Future<void> _captureCamera() async {
    try {
      final result = await CameraService.instance.capturePhoto(context);
      if (result.success && result.imagePath != null) {
        final capturedPath = result.imagePath!;
        setState(() {
          _galleryMedia.insert(0, capturedPath);
          _activePreviewPath = capturedPath;
          if (_isMultipleMode) {
            if (!_selectedMedia.contains(capturedPath)) {
              _selectedMedia.add(capturedPath);
            }
          } else {
            _selectedMedia.clear();
            _selectedMedia.add(capturedPath);
          }
        });
      } else if (!result.canceled && result.errorMessage != null && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(result.errorMessage!),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    } catch (e) {
      debugPrint('Error capturing photo: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to access camera: $e'),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    }
  }

  void _onThumbnailTapped(String path) {
    setState(() {
      _activePreviewPath = path;
      if (_isMultipleMode) {
        if (_selectedMedia.contains(path)) {
          if (_selectedMedia.length > 1) {
            _selectedMedia.remove(path);
            _activePreviewPath = _selectedMedia.last;
          }
        } else {
          _selectedMedia.add(path);
        }
      } else {
        _selectedMedia.clear();
        _selectedMedia.add(path);
      }
    });
  }

  void _toggleMultipleMode() {
    setState(() {
      _isMultipleMode = !_isMultipleMode;
      if (!_isMultipleMode && _selectedMedia.length > 1) {
        final keep = _activePreviewPath ?? _selectedMedia.first;
        _selectedMedia.clear();
        _selectedMedia.add(keep);
      } else if (_isMultipleMode && _selectedMedia.isEmpty && _activePreviewPath != null) {
        _selectedMedia.add(_activePreviewPath!);
      }
    });
  }

  void _togglePreviewFit() {
    setState(() {
      _previewFit = (_previewFit == BoxFit.contain) ? BoxFit.cover : BoxFit.contain;
    });
  }

  void _onNext() {
    if (!_isAuthenticated) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please sign in to publish a post.')),
      );
    }

    final mediaList = _selectedMedia.isNotEmpty
        ? _selectedMedia
        : (_activePreviewPath != null ? [_activePreviewPath!] : <String>[]);

    if (mediaList.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please select or capture a photo first.'),
          backgroundColor: Color(0xFF0095F6),
        ),
      );
      return;
    }

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => PostComposerPage(selectedMediaPaths: mediaList),
      ),
    );
  }

  void _onClose() {
    if (Navigator.canPop(context)) {
      Navigator.pop(context);
    } else {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const HomePage()),
      );
    }
  }

  void _onNavTap(int i) {
    if (i == _navIndex) return;

    if (i == 0) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const HomePage()),
      );
    } else if (i == 1) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const UserListPage()),
      );
    } else if (i == 3) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const NotificationPage()),
      );
    } else if (i == 4) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const ProfilePage()),
      );
    }
  }

  // --- Real Image Rendering Helpers ---

  Widget _buildMediaImage(
    String path, {
    BoxFit fit = BoxFit.cover,
    double? width,
    double? height,
    int? cacheWidth,
  }) {
    if (kIsWeb || path.startsWith('http://') || path.startsWith('https://') || path.startsWith('blob:')) {
      return Image.network(
        path,
        fit: fit,
        width: width,
        height: height,
        errorBuilder: (_, __, ___) => _buildImageError(),
      );
    }
    return Image.file(
      File(path),
      fit: fit,
      width: width,
      height: height,
      cacheWidth: cacheWidth,
      errorBuilder: (_, __, ___) => _buildImageError(),
    );
  }

  Widget _buildImageError() {
    return Container(
      color: const Color(0xFF1E2129),
      child: const Center(
        child: Icon(Icons.broken_image_outlined, color: Colors.white38, size: 24),
      ),
    );
  }

  // --- UI Section Builders ---

  Widget _buildTopNavBar() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      color: Colors.black,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Close button (✕)
          IconButton(
            icon: const Icon(Icons.close, color: Colors.white, size: 28),
            onPressed: _onClose,
            tooltip: 'Cancel',
          ),

          // POST / STORY / REEL Tabs
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              _buildTabItem('POST', PostTab.post),
              const SizedBox(width: 18),
              _buildTabItem('STORY', PostTab.story),
              const SizedBox(width: 18),
              _buildTabItem('REEL', PostTab.reel),
            ],
          ),

          // Next button (Vibrant blue, bold)
          GestureDetector(
            onTap: _onNext,
            child: const Padding(
              padding: EdgeInsets.symmetric(horizontal: 8, vertical: 6),
              child: Text(
                'Next',
                style: TextStyle(
                  color: Color(0xFF0095F6),
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.3,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTabItem(String label, PostTab tab) {
    final isActive = _activeTab == tab;
    return GestureDetector(
      onTap: () => setState(() => _activeTab = tab),
      child: Text(
        label,
        style: TextStyle(
          color: isActive ? Colors.white : Colors.grey.shade600,
          fontSize: 15,
          fontWeight: isActive ? FontWeight.bold : FontWeight.w500,
          letterSpacing: 0.8,
        ),
      ),
    );
  }

  /// Selected Media Preview: occupies ~33% screen height, displaying the active real image directly
  Widget _buildPreviewSection(double previewHeight) {
    return Container(
      height: previewHeight,
      width: double.infinity,
      color: const Color(0xFF0D0E12),
      child: _activePreviewPath != null
          ? Stack(
              fit: StackFit.expand,
              children: [
                Center(
                  child: _buildMediaImage(
                    _activePreviewPath!,
                    fit: _previewFit,
                    width: double.infinity,
                    height: double.infinity,
                  ),
                ),

                // Corner aspect ratio / zoom toggle button
                Positioned(
                  left: 12,
                  bottom: 12,
                  child: GestureDetector(
                    onTap: _togglePreviewFit,
                    child: Container(
                      padding: const EdgeInsets.all(7),
                      decoration: BoxDecoration(
                        color: Colors.black.withOpacity(0.65),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        _previewFit == BoxFit.contain
                            ? Icons.unfold_more_outlined
                            : Icons.unfold_less_outlined,
                        color: Colors.white,
                        size: 18,
                      ),
                    ),
                  ),
                ),

                // Corner multi-photo count badge if multi-select active
                if (_isMultipleMode && _selectedMedia.isNotEmpty)
                  Positioned(
                    right: 12,
                    bottom: 12,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.black.withOpacity(0.7),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.layers, color: Colors.white, size: 14),
                          const SizedBox(width: 4),
                          Text(
                            '${_selectedMedia.length}',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            )
          : Center(
              child: _isLoading
                  ? const SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white54,
                      ),
                    )
                  : Column(
                      mainAxisSize: MainAxisSize.min,
                      children: const [
                        Icon(Icons.photo_outlined, color: Colors.white38, size: 40),
                        SizedBox(height: 8),
                        Text(
                          'No photos found on device',
                          style: TextStyle(color: Colors.white54, fontSize: 13),
                        ),
                      ],
                    ),
            ),
    );
  }

  Widget _buildGalleryBar() {
    return Container(
      color: Colors.black,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Gallery album dropdown
          InkWell(
            onTap: _pickFromGallery,
            borderRadius: BorderRadius.circular(6),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 2),
              child: Row(
                children: const [
                  Text(
                    'Gallery',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  SizedBox(width: 4),
                  Icon(
                    Icons.keyboard_arrow_down,
                    color: Colors.white,
                    size: 22,
                  ),
                ],
              ),
            ),
          ),

          // Right Controls: Select multiple & Camera
          Row(
            children: [
              // Select multiple toggle button
              GestureDetector(
                onTap: _toggleMultipleMode,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: _isMultipleMode
                        ? const Color(0xFF0095F6)
                        : const Color(0xFF262626),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.layers_outlined,
                        size: 16,
                        color: _isMultipleMode ? Colors.white : Colors.white70,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        'Select multiple',
                        style: TextStyle(
                          color: _isMultipleMode ? Colors.white : Colors.white70,
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(width: 10),

              // Camera button
              GestureDetector(
                onTap: _captureCamera,
                child: Container(
                  padding: const EdgeInsets.all(7),
                  decoration: const BoxDecoration(
                    color: Color(0xFF262626),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.camera_alt_outlined,
                    color: Colors.white,
                    size: 20,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  /// 4-column Gallery Grid displaying real images from the machine
  Widget _buildGalleryGrid() {
    // If no media on device yet and not loading, show a friendly prompt
    if (_galleryMedia.isEmpty && !_isLoading) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.photo_library_outlined, color: Colors.white38, size: 48),
            const SizedBox(height: 12),
            const Text(
              'No images found in your gallery folders',
              style: TextStyle(color: Colors.white70, fontSize: 14),
            ),
            const SizedBox(height: 12),
            ElevatedButton.icon(
              onPressed: _pickFromGallery,
              icon: const Icon(Icons.add_photo_alternate_outlined),
              label: const Text('Browse Files'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0095F6),
                foregroundColor: Colors.white,
              ),
            ),
          ],
        ),
      );
    }

    // Grid starts with a Browse tile, followed by all real images from the machine
    final totalCount = _galleryMedia.length + 1;

    return Container(
      color: Colors.black,
      child: GridView.builder(
        padding: const EdgeInsets.only(bottom: 12),
        itemCount: totalCount,
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 4,
          crossAxisSpacing: 1.5,
          mainAxisSpacing: 1.5,
          childAspectRatio: 1.0,
        ),
        itemBuilder: (context, index) {
          // Tile 0: Browse / pick from other folders tile
          if (index == 0) {
            return InkWell(
              onTap: _pickFromGallery,
              child: Container(
                color: const Color(0xFF1E2129),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: const [
                    Icon(
                      Icons.add_photo_alternate_outlined,
                      color: Color(0xFF0095F6),
                      size: 26,
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Browse',
                      style: TextStyle(
                        color: Colors.white70,
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            );
          }

          final mediaPath = _galleryMedia[index - 1];
          final isSelected = _selectedMedia.contains(mediaPath);
          final isCurrentPreview = _activePreviewPath == mediaPath;
          final selectIndex = _selectedMedia.indexOf(mediaPath);

          return GestureDetector(
            onTap: () => _onThumbnailTapped(mediaPath),
            child: Stack(
              fit: StackFit.expand,
              children: [
                // Real thumbnail image from machine
                _buildMediaImage(
                  mediaPath,
                  fit: BoxFit.cover,
                  cacheWidth: 300,
                ),

                // Active preview highlight border
                if (isCurrentPreview && !_isMultipleMode)
                  Container(
                    decoration: BoxDecoration(
                      border: Border.all(color: Colors.white, width: 2.5),
                    ),
                  ),

                // Multi-select dimmed overlay
                if (_isMultipleMode && isSelected)
                  Container(
                    color: Colors.black.withOpacity(0.3),
                  ),

                // Multi-select numbered badge (Instagram style)
                if (_isMultipleMode)
                  Positioned(
                    top: 5,
                    right: 5,
                    child: Container(
                      width: 22,
                      height: 22,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: isSelected ? const Color(0xFF0095F6) : Colors.black.withOpacity(0.5),
                        border: Border.all(
                          color: Colors.white,
                          width: 1.5,
                        ),
                      ),
                      alignment: Alignment.center,
                      child: isSelected
                          ? Text(
                              '${selectIndex + 1}',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                              ),
                            )
                          : null,
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final screenHeight = MediaQuery.of(context).size.height;
    // Responsive preview height: ~33% of screen height
    final previewHeight = (screenHeight * 0.33).clamp(220.0, 380.0);

    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Column(
          children: [
            // 1. Top Navigation Bar: Close, POST/STORY/REEL, Next
            _buildTopNavBar(),

            // 2. Selected Media Preview (Direct real image preview, no upload button)
            _buildPreviewSection(previewHeight),

            // 3. Gallery Controls Bar: Gallery ∨, Select multiple, Camera
            _buildGalleryBar(),

            // 4. Scrollable 4-column Gallery Grid with real machine images
            Expanded(
              child: _buildGalleryGrid(),
            ),
          ],
        ),
      ),
      // Bottom Navigation Bar in dark mode
      bottomNavigationBar: BottomNavBar(
        currentIndex: _navIndex,
        isDark: true,
        onChanged: _onNavTap,
      ),
    );
  }
}
