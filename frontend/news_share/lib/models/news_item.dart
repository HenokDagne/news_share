// lib/models/news_item.dart
class NewsItem {
  final String source;
  final String timeAgo;
  final String title;
  final String subtitle;
  final String category;
  final String imageUrl;

  NewsItem({
    required this.source,
    required this.timeAgo,
    required this.title,
    required this.subtitle,
    required this.category,
    required this.imageUrl,
  });

  factory NewsItem.fromJson(Map<String, dynamic> json) {
    return NewsItem(
      source: json['source'] ?? '',
      timeAgo: json['timeAgo'] ?? '',
      title: json['title'] ?? '',
      subtitle: json['subtitle'] ?? '',
      category: json['category'] ?? json['tag'] ?? '',
      imageUrl: json['urlToImage'] ?? '',   // ✅ here
    );
  }
}
