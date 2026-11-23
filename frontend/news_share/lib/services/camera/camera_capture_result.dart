class CameraCaptureResult {
  final bool success;
  final String? imagePath;
  final bool canceled;
  final String? errorMessage;

  const CameraCaptureResult({
    required this.success,
    this.imagePath,
    this.canceled = false,
    this.errorMessage,
  });

  factory CameraCaptureResult.success(String path) {
    return CameraCaptureResult(success: true, imagePath: path);
  }

  factory CameraCaptureResult.canceled() {
    return const CameraCaptureResult(success: false, canceled: true);
  }

  factory CameraCaptureResult.error(String message) {
    return CameraCaptureResult(success: false, errorMessage: message);
  }
}
