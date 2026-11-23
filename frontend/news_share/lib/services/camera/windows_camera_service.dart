import 'package:camera/camera.dart';
import 'package:flutter/material.dart';

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
      final cameras = await availableCameras();
      if (cameras.isEmpty) {
        return CameraCaptureResult.error('No webcam detected on this PC. Please connect a webcam.');
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
      return CameraCaptureResult.error('Webcam error: $e');
    }
  }

  @override
  void dispose() {}
}
