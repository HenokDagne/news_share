import 'package:flutter/widgets.dart';
import 'camera_capture_result.dart';

abstract class CameraService {
  static CameraService? _instance;

  static CameraService get instance {
    if (_instance == null) {
      throw StateError('CameraService has not been initialized. Call initCameraService() first.');
    }
    return _instance!;
  }

  static void register(CameraService service) {
    _instance = service;
  }

  /// Checks if camera hardware exists and is available on the current device
  Future<bool> isCameraAvailable();

  /// Opens the camera interface (webcam dialog on PC, native camera on mobile)
  /// and returns the captured image file path.
  Future<CameraCaptureResult> capturePhoto(BuildContext context);

  /// Disposes any active camera resources
  void dispose();
}
