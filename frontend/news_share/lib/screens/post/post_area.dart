import 'package:flutter/material.dart';

class PostArea extends StatelessWidget {
  const PostArea({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      Container(
        
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
        ),
        child: TextField(
          maxLines: 4,
          decoration: const InputDecoration(
            hintText: 'share news or your thoughts...',
            // border: OutlineInputBorder(
            //   borderSide: BorderSide(color: Colors.white),
            // ),
          ),
        ),
      )
    ]);
  }
}
