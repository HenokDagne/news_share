import 'package:flutter/material.dart';
import 'screens/home/home_page.dart';

void main() {
  runApp(const NewsShareApp());
}

class NewsShareApp extends StatelessWidget {
  const NewsShareApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'NewsShare',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        primaryColor: const Color(0xFF2563EB),
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF2563EB)),
        useMaterial3: true,
      ),
      home: const HomePage(),
    );
  }
}
