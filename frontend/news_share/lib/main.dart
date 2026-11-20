import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'screens/home/splash_screen.dart';
import 'services/api_client.dart';

class NewsShareApp extends StatelessWidget {
  const NewsShareApp({super.key});

  static final ThemeData _appTheme = ThemeData(
    primaryColor: const Color(0xFF2563EB),
    colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF2563EB)),
    useMaterial3: true,
  );

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'NewsShare',
      debugShowCheckedModeBanner: false,
      theme: _appTheme,
      home: const SplashScreen(),
    );
  }
}

/// Global future tracking background initialization (dotenv, ApiClient)
late final Future<void> appInitializationFuture;

Future<void> _initializeApp() async {
  try {
    await dotenv.load(fileName: '.env');
  } catch (_) {
    try {
      await dotenv.load(fileName: 'assets/.env');
    } catch (e) {
      debugPrint('No .env file found or error loading .env: $e');
    }
  }

  await ApiClient.instance.init();
}

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  appInitializationFuture = _initializeApp();
  runApp(const NewsShareApp());
}
