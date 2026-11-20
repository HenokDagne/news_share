/*
  Provides backend REST API post utilities:
  creates posts with title, content, and optional image file via multipart request.
*/

import 'dart:io';
import '../../services/api_client.dart';

class PostService {
  String? lastError;

  /// Create a post with optional title, content, and local image File
  Future<bool> createPost({
    String? title,
    String? content,
    String? imageUrl,
    File? imageFile,
  }) async {
    try {
      lastError = null;
      if (!ApiClient.instance.isAuthenticated) {
        lastError = 'You must be logged in to create a post';
        return false;
      }

      // If an image file path was passed as imageUrl (or as imageFile)
      File? uploadFile = imageFile;
      if (uploadFile == null && imageUrl != null && !imageUrl.startsWith('http')) {
        uploadFile = File(imageUrl);
      }

      await ApiClient.instance.createPost(
        title: title,
        content: content,
        image: uploadFile,
      );

      return true;
    } on ApiException catch (e) {
      lastError = e.message;
      print('Error creating post: ${e.message}');
      return false;
    } catch (e, stackTrace) {
      lastError = e.toString();
      print('Error creating post: $e');
      print(stackTrace);
      return false;
    }
  }

  /// For compatibility if photo picker returns local path
  Future<String?> uploadImage(File file) async {
    return file.path;
  }
}
