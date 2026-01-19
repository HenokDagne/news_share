
/// NewsService fetches Tesla + US business headlines from NewsAPI, enforcing a 20s timeout,
/// requires `NEWS_API_KEY` from .env, safely casts/merges responses, deduplicates by URL,
/// and returns a UI-ready `List<NewsItem>`, falling back to an empty list on errors.
// ...existing code...


import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/news_item.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';

class NewsService {
  static const Duration timeout = Duration(seconds: 20);

  String get _apiKey => dotenv.env['NEWS_API_KEY'] ?? '';

  /// ✅ Returns List<NewsItem> (matches your UI)
  Future<List<NewsItem>> fetchNews() async {
    try {
      print('🚀 Fetching Tesla + Business news...');

      final apiKey = _apiKey;
      if (apiKey.isEmpty) {
        throw StateError(
          'NEWS_API_KEY is missing. Ensure .env is loaded before using NewsService.',
        );
      }

      final teslaUrl = Uri.parse(
        'https://newsapi.org/v2/everything?q=tesla&from=2026-01-01&sortBy=publishedAt&apiKey=$apiKey',
      );
      final businessUrl = Uri.parse(
        'https://newsapi.org/v2/top-headlines?country=us&category=business&apiKey=$apiKey',
      );

      final responses = await Future.wait([
        http.get(teslaUrl).timeout(timeout),
        http.get(businessUrl).timeout(timeout),
      ]);

      List<Map<String, dynamic>> allArticles = [];

      // Tesla
      if (responses[0].statusCode == 200) {
        final data = jsonDecode(responses[0].body);
        if (data is Map<String, dynamic>) {
          final articles = data['articles'];
          if (articles is List) {
            allArticles.addAll(_safeCastArticles(articles));
          }
        }
      }

      // Business
      if (responses[1].statusCode == 200) {
        final data = jsonDecode(responses[1].body);
        if (data is Map<String, dynamic>) {
          final articles = data['articles'];
          if (articles is List) {
            allArticles.addAll(_safeCastArticles(articles));
          }
        }
      }

      // Deduplicate + Parse to NewsItem
      final uniqueArticles = _deduplicateArticles(allArticles);
      final newsItems = uniqueArticles
          .map((json) => NewsItem.fromJson(json as Map<String, dynamic>))
          .toList();

      print('✅ Returning ${newsItems.length} NewsItem objects');
      return newsItems;
    } catch (e, stack) {
      print('💥 NewsService ERROR: $e\n$stack');
      return []; // Empty list fallback
    }
  }

  List<Map<String, dynamic>> _safeCastArticles(List articles) {
    return articles
        .map((item) {
          if (item is Map<String, dynamic>) return item;
          if (item is Map) return Map<String, dynamic>.from(item);
          return <String, dynamic>{};
        })
        .where((item) => item.isNotEmpty)
        .toList();
  }

  List<Map<String, dynamic>> _deduplicateArticles(
    List<Map<String, dynamic>> articles,
  ) {
    final seenUrls = <String>{};
    return articles.where((article) {
      final url = article['url']?.toString() ?? '';
      if (url.isNotEmpty && !seenUrls.contains(url)) {
        seenUrls.add(url);
        return true;
      }
      return false;
    }).toList();
  }
}
