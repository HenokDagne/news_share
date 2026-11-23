import 'package:camera/camera.dart';
import 'package:flutter/material.dart';

class WindowsCameraDialog extends StatefulWidget {
  final List<CameraDescription> cameras;

  const WindowsCameraDialog({
    super.key,
    required this.cameras,
  });

  @override
  State<WindowsCameraDialog> createState() => _WindowsCameraDialogState();
}

class _WindowsCameraDialogState extends State<WindowsCameraDialog> {
  CameraController? _controller;
  int _selectedCameraIndex = 0;
  bool _isInitializing = true;
  bool _isCapturing = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _initCurrentCamera();
  }

  Future<void> _initCurrentCamera() async {
    if (widget.cameras.isEmpty) {
      setState(() {
        _isInitializing = false;
        _errorMessage = 'No camera found on this device.';
      });
      return;
    }

    setState(() {
      _isInitializing = true;
      _errorMessage = null;
    });

    final previousController = _controller;
    final camera = widget.cameras[_selectedCameraIndex];

    final controller = CameraController(
      camera,
      ResolutionPreset.high,
      enableAudio: false,
    );

    try {
      await previousController?.dispose();
      await controller.initialize();
      if (!mounted) {
        await controller.dispose();
        return;
      }
      setState(() {
        _controller = controller;
        _isInitializing = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = 'Failed to access webcam: $e';
        _isInitializing = false;
      });
    }
  }

  Future<void> _takePicture() async {
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized || _isCapturing) {
      return;
    }

    setState(() => _isCapturing = true);

    try {
      final XFile file = await controller.takePicture();
      if (!mounted) return;
      Navigator.of(context).pop(file.path);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to capture photo: $e'),
          backgroundColor: Colors.red,
        ),
      );
      setState(() => _isCapturing = false);
    }
  }

  void _switchCamera() {
    if (widget.cameras.length <= 1) return;
    setState(() {
      _selectedCameraIndex = (_selectedCameraIndex + 1) % widget.cameras.length;
    });
    _initCurrentCamera();
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.black,
      insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 580, maxHeight: 680),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: Column(
            children: [
              // Header
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                color: const Color(0xFF16181F),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.videocam, color: Color(0xFF0095F6), size: 22),
                        SizedBox(width: 8),
                        Text(
                          'Webcam Capture',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                    Row(
                      children: [
                        if (widget.cameras.length > 1)
                          IconButton(
                            icon: const Icon(Icons.flip_camera_ios, color: Colors.white70),
                            onPressed: _switchCamera,
                            tooltip: 'Switch camera',
                          ),
                        IconButton(
                          icon: const Icon(Icons.close, color: Colors.white70),
                          onPressed: () => Navigator.of(context).pop(null),
                          tooltip: 'Cancel',
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              // Viewfinder body
              Expanded(
                child: Container(
                  color: Colors.black,
                  child: Center(
                    child: _isInitializing
                        ? const Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              CircularProgressIndicator(color: Color(0xFF0095F6)),
                              SizedBox(height: 12),
                              Text(
                                'Starting camera...',
                                style: TextStyle(color: Colors.white70),
                              ),
                            ],
                          )
                        : _errorMessage != null
                            ? Padding(
                                padding: const EdgeInsets.all(24),
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    const Icon(Icons.videocam_off, color: Colors.redAccent, size: 48),
                                    const SizedBox(height: 12),
                                    Text(
                                      _errorMessage!,
                                      textAlign: TextAlign.center,
                                      style: const TextStyle(color: Colors.white70),
                                    ),
                                  ],
                                ),
                              )
                            : (_controller != null && _controller!.value.isInitialized)
                                ? CameraPreview(_controller!)
                                : const SizedBox.shrink(),
                  ),
                ),
              ),

              // Footer controls
              Container(
                padding: const EdgeInsets.symmetric(vertical: 20),
                color: const Color(0xFF16181F),
                child: Center(
                  child: _isCapturing
                      ? const SizedBox(
                          width: 56,
                          height: 56,
                          child: CircularProgressIndicator(color: Color(0xFF0095F6)),
                        )
                      : GestureDetector(
                          onTap: (_controller != null && _controller!.value.isInitialized)
                              ? _takePicture
                              : null,
                          child: Container(
                            width: 64,
                            height: 64,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              border: Border.all(color: Colors.white, width: 4),
                              color: const Color(0xFF0095F6),
                            ),
                            child: const Icon(
                              Icons.camera_alt,
                              color: Colors.white,
                              size: 30,
                            ),
                          ),
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
