/*
  NewsService aggregates posts from the local NestJS backend API (personal feed when authenticated,
  or global posts timeline) and merges real-time external headlines from NewsAPI,
  reading the API key and URL securely from .env.
*/

import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../models/news_item.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'api_client.dart';

class NewsService {
  static const Duration timeout = Duration(seconds: 15);

  /// Read securely from .env
  String get _apiKey => dotenv.env['NEWS_API_KEY'] ?? '';
  String get _baseUrl =>
      dotenv.env['NEWS_API_BASE_URL'] ?? 'https://newsapi.org/v2/everything';

  /// Returns List<NewsItem> combining NestJS backend posts with live third-party NewsAPI articles.
  Future<List<NewsItem>> fetchNews({
    String query = '',
    bool requireAuth = false,
  }) async {
    final List<NewsItem> allItems = [];
    final queryTrimmed = query.trim();
    final queryLower = queryTrimmed.toLowerCase();

    if (requireAuth && !ApiClient.instance.isAuthenticated) {
      throw StateError('User must be authenticated to fetch news.');
    }

    final results = await Future.wait([
      _fetchBackend(queryLower, requireAuth),
      _fetchThirdPartyNews(queryTrimmed, queryLower),
    ]);

    allItems.addAll(results[0]);
    allItems.addAll(results[1]);
    return allItems;
  }

  Future<List<NewsItem>> _fetchBackend(String queryLower, bool requireAuth) async {
    final List<NewsItem> items = [];
    try {
      final List<Map<String, dynamic>> backendPosts;
      if (ApiClient.instance.isAuthenticated) {
        final feedPosts = await ApiClient.instance.getFeed(limit: 50);
        if (feedPosts.isNotEmpty) {
          backendPosts = feedPosts;
        } else {
          backendPosts = await ApiClient.instance.getPosts(limit: 50);
        }
      } else {
        backendPosts = await ApiClient.instance.getPosts(limit: 50);
      }

      final postItems = backendPosts
          .map((p) => NewsItem.fromPostJson(p))
          .where((item) => _matchesQuery(item, queryLower))
          .toList();

      items.addAll(postItems);
      debugPrint('Fetched ${postItems.length} posts from NestJS backend');
    } catch (e) {
      debugPrint('Backend posts fetch notice: $e');
    }
    return items;
  }

  Future<List<NewsItem>> _fetchThirdPartyNews(String queryTrimmed, String queryLower) async {
    final List<NewsItem> items = [];
    final apiKey = _apiKey;
    final baseUrl = _baseUrl;

    if (apiKey.isEmpty || baseUrl.isEmpty) return items;

    try {
      final topic = queryTrimmed.isNotEmpty ? queryTrimmed : 'apple';
      final now = DateTime.now();
      final yesterday = now.subtract(const Duration(days: 1));
      final fromDate =
          "${yesterday.year}-${yesterday.month.toString().padLeft(2, '0')}-${yesterday.day.toString().padLeft(2, '0')}";
      final toDate =
          "${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}";

      final uri = Uri.parse(baseUrl).replace(
        queryParameters: {
          'q': topic,
          'from': fromDate,
          'to': toDate,
          'sortBy': 'popularity',
          'pageSize': '20',
          'apiKey': apiKey,
        },
      );

      debugPrint(
        'Fetching third-party news from NewsAPI: ${uri.origin}${uri.path}?q=$topic',
      );

      final response = await http.get(uri).timeout(timeout);

      if (response.statusCode == 200 && response.body.isNotEmpty) {
        final data = jsonDecode(response.body);
        if (data is Map<String, dynamic> && data['articles'] is List) {
          final articles = _safeCastArticles(data['articles'] as List);
          final uniqueArticles = _deduplicateArticles(articles);
          final newsApiItems = uniqueArticles
              .map((json) => NewsItem.fromJson(json))
              .where((item) => _matchesQuery(item, queryLower))
              .toList();

          items.addAll(newsApiItems);
          debugPrint(
            'Fetched ${newsApiItems.length} real news articles from NewsAPI',
          );
        }
      } else {
        debugPrint('NewsAPI returned status code: ${response.statusCode}');
      }
    } catch (e) {
      debugPrint('NewsAPI fetch error: $e');
    }
    return items;
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

  bool _matchesQuery(NewsItem item, String queryLower) {
    if (queryLower.isEmpty) return true;
    return item.title.toLowerCase().contains(queryLower) ||
        item.subtitle.toLowerCase().contains(queryLower) ||
        item.source.toLowerCase().contains(queryLower);
  }
}
