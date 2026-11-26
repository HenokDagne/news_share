import 'package:flutter/widgets.dart';
import 'package:image_picker/image_picker.dart';

import 'camera_capture_result.dart';
import 'camera_service.dart';

class MobileCameraService implements CameraService {
  final ImagePicker _picker = ImagePicker();

  @override
  Future<bool> isCameraAvailable() async {
    return true;
  }

  @override
  Future<CameraCaptureResult> capturePhoto(BuildContext context) async {
    try {
      final XFile? photo = await _picker.pickImage(
        source: ImageSource.camera,
        preferredCameraDevice: CameraDevice.rear,
      );
      if (photo != null) {
        return CameraCaptureResult.success(photo.path);
      }
      return CameraCaptureResult.canceled();
    } catch (e) {
      // If camera is unsupported (e.g. web/desktop without cameraDelegate), fall back to gallery picker
      try {
        final XFile? file = await _picker.pickImage(source: ImageSource.gallery);
        if (file != null) {
          return CameraCaptureResult.success(file.path);
        }
        return CameraCaptureResult.canceled();
      } catch (_) {
        return CameraCaptureResult.error('Camera error: $e');
      }
    }
  }

  @override
  void dispose() {}
}
