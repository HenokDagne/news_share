import 'dart:io';
import 'package:flutter/foundation.dart';

import 'camera_service.dart';
import 'mobile_camera_service.dart';
import 'windows_camera_service.dart';

void initCameraService() {
  if (!kIsWeb && Platform.isWindows) {
    CameraService.register(WindowsCameraService());
  } else {
    CameraService.register(MobileCameraService());
  }
}
