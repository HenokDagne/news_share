import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:news_share/services/news_service.dart';
import 'package:news_share/models/news_item.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() async {
    HttpOverrides.global = null;
    await dotenv.load(fileName: '.env');
  });

  test('NewsService consumes real NewsAPI using key and URL from .env', () async {
    final service = NewsService();

    final articles = await service.fetchNews();
    expect(articles, isNotEmpty);
    expect(articles, isA<List<NewsItem>>());

    print('Successfully fetched ${articles.length} news items:');
    for (int i = 0; i < articles.length.clamp(0, 3); i++) {
      final a = articles[i];
      print('[${i + 1}] Source: ${a.source} | Title: ${a.title} | Time: ${a.timeAgo}');
    }
  });
}
