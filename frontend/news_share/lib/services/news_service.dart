import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/news_item.dart';

class NewsService {
  static const String _baseUrl = 'http://127.0.0.1:8000';
  static const Duration timeout = Duration(seconds: 20);

  Future<List<NewsItem>> fetchNews() async {
    try {
      final response = await http
          .get(
            Uri.parse('$_baseUrl/news/'),
            headers: {'Content-Type': 'application/json'},
          )
          .timeout(timeout);

      if (response.statusCode == 200) {
        final dynamic data = jsonDecode(response.body);

        // Handle both List and Map responses
        List<Map<String, dynamic>> articles = [];

        if (data is List) {
          articles = data.cast<Map<String, dynamic>>();
        } else if (data is Map) {
          articles =
              (data['articles'] ?? [])?.cast<Map<String, dynamic>>() ?? [];
        }

        print('✅ Fetched ${articles.length} news articles');
        return articles.map((article) => NewsItem.fromJson(article)).toList();
      } else {
        throw Exception('Failed to load news: ${response.statusCode}');
      }
    } catch (e) {
      print('💥 NewsService Error: $e');
      throw Exception('Network error: $e');
    }
  }
}
