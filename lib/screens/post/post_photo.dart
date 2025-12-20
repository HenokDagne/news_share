import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'publish_button.dart';
class PostPhoto extends StatelessWidget {
  const PostPhoto({super.key});
  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          margin: const EdgeInsets.symmetric(vertical: 5, horizontal: 6),

          height: 70,
          //width: 100,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.08),
                blurRadius: 8,
                offset: Offset(0, 2),
              ),
            ],
          ),
          child: Row(
            children: [
              Container(
                margin: const EdgeInsets.only(left: 10),
                width: 120,
                decoration: BoxDecoration(
                  color: Colors.grey[200],
                  borderRadius: BorderRadius.circular(12),
                ),
                child: IconButton(
                  mouseCursor: SystemMouseCursors.click,
                  icon: const Icon(Icons.camera,
                      color: Colors.black, size: 24),
                  onPressed: () async {
                    final ImagePicker picker = ImagePicker();
                    final XFile? image =
                        await picker.pickImage(source: ImageSource.gallery);
                    if (image != null) {
                      debugPrint('Selected image path: ${image.path}');
                    } else {
                      debugPrint('No image selected.');
                    }
                  },
                ),
              ),
              Container(
                margin: const EdgeInsets.only(left: 10),
                width: 120,
                decoration: BoxDecoration(
                  color: Colors.grey[200],
                  borderRadius: BorderRadius.circular(12),
                ),
                
                child: IconButton(
                  mouseCursor: SystemMouseCursors.click,
                  icon: const Icon(Icons.video_library,
                      color: Colors.black, size: 24),
                  onPressed: () async {
                    final ImagePicker picker = ImagePicker();
                    final XFile? video =
                        await picker.pickVideo(source: ImageSource.gallery);
                    if (video != null) {
                      debugPrint('Selected video path: ${video.path}');
                    } else {
                      debugPrint('No video selected.');
                    }
                  },
                ),
              ),
              Container(
                margin: const EdgeInsets.only(left: 10),
                width: 120,
                decoration: BoxDecoration(
                  color: Colors.grey[200],
                  borderRadius: BorderRadius.circular(12),
                ),
                child: IconButton(
                  mouseCursor: SystemMouseCursors.click,
                  icon: const Icon(Icons.add_link,
                      color: Colors.black, size: 24),
                  onPressed: () async {
                    debugPrint('Link button pressed.');
                  },
                ),
              )

            ],
          ),
        ),
        const SizedBox(height: 4),
        Container(
          margin: const EdgeInsetsDirectional.symmetric(horizontal: 6, vertical: 2),
          child: const PublishButton(),
        )
      ],
    );
  }
}
