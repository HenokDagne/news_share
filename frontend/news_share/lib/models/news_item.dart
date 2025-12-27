// lib/models/news_item.dart
class NewsItem {
  final String source;
  final String timeAgo;
  final String title;
  final String subtitle;
  final String category;
  final int likes;
  final int comments;
  final int shares;

  NewsItem({
    required this.source,
    required this.timeAgo,
    required this.title,
    required this.subtitle,
    required this.category,
    required this.likes,
    required this.comments,
    required this.shares,
  });

  factory NewsItem.fromJson(Map<String, dynamic> json) {
    return NewsItem(
      source: json['source'] ?? '',
      timeAgo: json['timeAgo'] ?? '',
      title: json['title'] ?? '',
      subtitle: json['subtitle'] ?? '',
      category: json['category'] ?? json['tag'] ?? '',
      likes: (json['likes'] ?? 0) as int,
      comments: (json['comments'] ?? 0) as int,
      shares: (json['shares'] ?? 0) as int,
    );
  }
}

