/*
  Picks an avatar from the gallery, uploads it via NestJS backend API,
  and triggers a profile reload.
*/

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:io';
import '../../services/api_client.dart';

/// Pick a temporary avatar image from gallery
Future<File?> pickTempAvatar(BuildContext context) async {
  try {
    final picker = ImagePicker();
    final pickedFile = await picker.pickImage(source: ImageSource.gallery);
    if (pickedFile == null) return null;
    return File(pickedFile.path);
  } catch (e) {
    if (context.mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Error picking image: $e')));
    }
    return null;
  }
}

/// Upload avatar file via ApiClient and reload profile
Future<void> saveAvatarToSupabase({
  required BuildContext context,
  dynamic supabase, // Kept as dynamic for compatibility
  required File file,
  required Future<void> Function() reloadProfile,
}) async {
  if (!ApiClient.instance.isAuthenticated) return;

  try {
    await ApiClient.instance.uploadAvatar(file);
    await reloadProfile();

    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Profile picture saved!')),
      );
    }
  } catch (e) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error saving image: $e')),
      );
    }
  }
}
