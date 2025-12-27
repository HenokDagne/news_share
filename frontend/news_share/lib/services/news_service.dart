import 'dart:convert';
import 'dart:io';  // ✅ For platform detection
import 'package:flutter/foundation.dart';  // ✅ For kIsWeb
import 'package:http/http.dart' as http;
import '../models/news_item.dart';

class NewsService {
  // ✅ Dynamic URL based on platform
  static String get baseUrl {
    if (kIsWeb) {
      // Flutter Web: Use ngrok/public URL or localhost
      return 'http://localhost:3000';
    }
    // Mobile: Use PC IP
    return 'http://192.168.1.8:3000';
  }
  
  static const Duration _timeout = Duration(seconds: 10);

  static Future<List<NewsItem>> fetchNews() async {
    try {
      print('🌐 Using URL: $baseUrl/news');  // ✅ Debug
      print('📱 Platform: ${kIsWeb ? "Web" : "Mobile"}');
      
      final response = await http
          .get(Uri.parse('$baseUrl/news'))
          .timeout(_timeout);

      print('📡 Status: ${response.statusCode}');  // ✅ Debug

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        List<dynamic> articles;

        if (data is Map && data['articles'] != null) {
          articles = data['articles'] as List<dynamic>;
        } else if (data is List) {
          articles = data;
        } else {
          throw Exception('Invalid news format');
        }

        return articles
            .map((item) => NewsItem.fromJson(item as Map<String, dynamic>))
            .toList();
      } else {
        throw Exception('Server error: ${response.statusCode}');
      }
    } catch (e) {
      print('❌ NewsService Error: $e');
      rethrow;
    }
  }
}
