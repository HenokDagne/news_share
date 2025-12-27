import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:shelf/shelf.dart';
import 'package:shelf/shelf_io.dart' as shelf_io;
import 'middleware/news_middleware.dart';
import 'handlers/news_handler.dart';
import 'package:dotenv/dotenv.dart';  // ✅ Load ONCE

Future<void> main() async {
  // Load .env file from project root (only load once)
  // ✅ Load .env ONCE at startup
  final env = DotEnv()..load();
  final handler = Pipeline()
      
      //.addMiddleware(corsHeaders()) // ✅ CORS for Flutter
       // ✅ CLOSURE: Captures env, creates proper Handler
      .addHandler((Request request) => fetchNewsHandler(request, env));

  final ports = [3000, 8081, 5000, 8000];
  HttpServer? server;
  
  // ✅ Get REAL local IP addresses
  final localIps = await _getLocalIps();
  
  for (int port in ports) {
    try {
      server = await shelf_io.serve(handler, InternetAddress.anyIPv4, port);
      
      print('✅ NewsItem API on http://${server.address.host}:$port/news');
      print('🔍 Your PC IPs: $localIps');
      print('📱 Flutter: http://192.168.1.8:$port/news');
      print('🌐 Test on SAME PC: http://localhost:$port/news');
      print('═' * 80);
      break;
    } catch (e) {
      print('❌ Port $port in use, trying next...');
    }
  }

  if (server == null) {
    print('💥 No available ports!');
    return;
  }

  print('🔥 Fetching Tesla news...');
  await _showAllNews(port: server.port);
}

// ✅ Get all local IP addresses
Future<List<String>> _getLocalIps() async {
  final interfaces = await NetworkInterface.list(type: InternetAddressType.IPv4);
  return interfaces
      .expand((interface) => interface.addresses)
      .where((addr) => !addr.isLoopback)
      .map((addr) => addr.address)
      .toList();
}

Future<void> _showAllNews({required int port}) async {
  try {
    final response = await http.get(Uri.parse('http://localhost:$port/news'));
    
    if (response.statusCode == 200) {
      final news = jsonDecode(response.body);
      print('\n📢 TESLA + BUSINESS NEWS (${news.length} articles):');
      print('📊 ✅ Server works perfectly!');
      print('═' * 80);
    } else {
      print('❌ Server error: ${response.statusCode}');
    }
  } catch (e) {
    print('⚠️ Local test failed: $e');
  }
}
