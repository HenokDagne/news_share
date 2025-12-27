import 'package:flutter/material.dart';

class PublishButton extends StatelessWidget {
  const PublishButton({super.key});
  @override
  Widget build(BuildContext context) {
    return ElevatedButton(
      onPressed: () {
        print("Publish button pressed");
        // Handle publish button press
      },

      style: ElevatedButton.styleFrom(
        backgroundColor: Colors.blue,
        foregroundColor: Colors.white,

        padding: const EdgeInsets.symmetric(vertical: 30),
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
      child: const Text("Publish"),
    );
  }
}
