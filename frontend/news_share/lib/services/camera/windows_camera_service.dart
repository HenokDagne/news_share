import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import 'camera_capture_result.dart';
import 'camera_service.dart';
import 'windows_camera_dialog.dart';

class WindowsCameraService implements CameraService {
  @override
  Future<bool> isCameraAvailable() async {
    try {
      final cameras = await availableCameras();
      return cameras.isNotEmpty;
    } catch (_) {
      return false;
    }
  }

  @override
  Future<CameraCaptureResult> capturePhoto(BuildContext context) async {
    try {
      List<CameraDescription> cameras = [];
      bool channelFailed = false;

      try {
        cameras = await availableCameras();
      } catch (channelErr) {
        channelFailed = true;
        debugPrint('Windows camera channel error: $channelErr');
      }

      // If channel is not linked (requires full flutter rebuild) or no webcam detected:
      if (channelFailed || cameras.isEmpty) {
        if (!context.mounted) return CameraCaptureResult.canceled();

        final fallbackChoice = await showDialog<String>(
          context: context,
          builder: (ctx) => AlertDialog(
            backgroundColor: const Color(0xFF16181F),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            title: const Row(
              children: [
                Icon(Icons.videocam_outlined, color: Color(0xFF0095F6), size: 24),
                SizedBox(width: 10),
                Text(
                  'Webcam Not Ready',
                  style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                ),
              ],
            ),
            content: Text(
              channelFailed
                  ? 'The Windows webcam native plugin was recently added and requires a full application restart to compile and link native C++ camera drivers.\n\nIn the meantime, would you like to choose a photo from your PC files instead?'
                  : 'No webcam hardware was detected on this PC.\n\nWould you like to choose a photo from your PC files instead?',
              style: const TextStyle(color: Colors.white70, fontSize: 13, height: 1.4),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(ctx).pop('cancel'),
                child: const Text('Cancel', style: TextStyle(color: Colors.grey)),
              ),
              ElevatedButton.icon(
                onPressed: () => Navigator.of(ctx).pop('browse'),
                icon: const Icon(Icons.photo_library_outlined, size: 16),
                label: const Text('Choose Photo'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0095F6),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
              ),
            ],
          ),
        );

        if (fallbackChoice == 'browse') {
          final picker = ImagePicker();
          final XFile? file = await picker.pickImage(source: ImageSource.gallery);
          if (file != null) {
            return CameraCaptureResult.success(file.path);
          }
        }
        return CameraCaptureResult.canceled();
      }

      if (!context.mounted) {
        return CameraCaptureResult.canceled();
      }

      final String? photoPath = await showDialog<String>(
        context: context,
        barrierDismissible: false,
        builder: (_) => WindowsCameraDialog(cameras: cameras),
      );

      if (photoPath != null && photoPath.isNotEmpty) {
        return CameraCaptureResult.success(photoPath);
      }
      return CameraCaptureResult.canceled();
    } catch (e) {
      debugPrint('WindowsCameraService error: $e');
      return CameraCaptureResult.error('Webcam error: $e');
    }
  }

  @override
  void dispose() {}
}
