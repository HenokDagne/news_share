import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shelf/shelf.dart';
import '../utils/formatters.dart';
import 'package:dotenv/dotenv.dart';

late final DotEnv dotEnv;

Future<Response> fetchNewsHandler(Request request, DotEnv env) async {
  try {
    print('🔍 Fetching Tesla + World Business news...');
    
    final newsApiKey = env['NEWS_API_KEY'] ?? '';
    // ✅ Tesla News (Everything endpoint)
    final teslaUrl = Uri.parse(
      'https://newsapi.org/v2/everything?q=tesla&from=2025-11-21&sortBy=publishedAt&apiKey=$newsApiKey',
    );

    // ✅ World Business News (Top Headlines)
    final businessUrl = Uri.parse(
      'https://newsapi.org/v2/top-headlines?country=us&category=business&apiKey=$newsApiKey',
    );

    print('📡 Fetching Tesla news...');
    final teslaResponse = await http.get(teslaUrl);
    print('📡 Fetching Business news...');
    final businessResponse = await http.get(businessUrl);

    print(
      '📥 Tesla: ${teslaResponse.statusCode} | Business: ${businessResponse.statusCode}',
    );

    List<Map<String, dynamic>> allArticles = [];

    // ✅ Process Tesla News
    if (teslaResponse.statusCode == 200) {
      final teslaJson = jsonDecode(teslaResponse.body);
      final teslaArticles = teslaJson['articles'] as List;
      print(
        '✅ Tesla: ${teslaArticles.length} articles (${teslaJson['totalResults']} total)',
      );

      final formattedTesla = teslaArticles
          .map((article) => formatNewsArticle(article))
          .toList();
      allArticles.addAll(formattedTesla);
    }

    // ✅ Process Business News
    if (businessResponse.statusCode == 200) {
      final businessJson = jsonDecode(businessResponse.body);
      final businessArticles = businessJson['articles'] as List;
      print(
        '✅ Business: ${businessArticles.length} articles (${businessJson['totalResults']} total)',
      );

      final formattedBusiness = businessArticles
          .map((article) => formatNewsArticle(article))
          .toList();
      allArticles.addAll(formattedBusiness);
    }

    print('📤 Combined: ${allArticles.length} articles (Tesla + Business)');

    // ✅ Deduplicate by URL
    final uniqueArticles = _deduplicateArticles(allArticles);
    print('🎯 Unique: ${uniqueArticles.length} articles');

    return Response.ok(
      jsonEncode(uniqueArticles),
      headers: {
        'Content-Type': 'application/json',
        'X-Tesla-Count': teslaResponse.statusCode == 200
            ? allArticles.length.toString()
            : '0',
        'X-Business-Count': businessResponse.statusCode == 200
            ? allArticles.length.toString()
            : '0',
        'X-Total-Unique': uniqueArticles.length.toString(),
      },
    );
  } catch (e) {
    print('💥 Handler Error: $e');
    return Response.internalServerError(
      body: jsonEncode({'error': 'Server error', 'message': e.toString()}),
      headers: {'Content-Type': 'application/json'},
    );
  }
}

// ✅ Remove duplicate articles by URL
List<Map<String, dynamic>> _deduplicateArticles(
  List<Map<String, dynamic>> articles,
) {
  final seenUrls = <String>{};
  final unique = <Map<String, dynamic>>[];

  for (final article in articles) {
    final url = article['url'] ?? '';
    if (!seenUrls.contains(url) && url.isNotEmpty) {
      seenUrls.add(url);
      unique.add(article);
    }
  }
  return unique;
}
