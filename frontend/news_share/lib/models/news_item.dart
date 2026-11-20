class NewsItem {
  final String? id;
  final String? userId;
  final String source;
  final String timeAgo;
  final String title;
  final String subtitle;
  final String category;
  final String imageUrl;
  final String url;

  NewsItem({
    this.id,
    this.userId,
    required this.source,
    required this.timeAgo,
    required this.title,
    required this.subtitle,
    required this.category,
    required this.imageUrl,
    required this.url,
  });

  /// Accepts either a NestJS backend Post JSON or external NewsAPI JSON
  factory NewsItem.fromJson(Map<String, dynamic> json) {
    // If it has publishedAt or a source map, it is an external NewsAPI article
    final isNewsApi = json.containsKey('publishedAt') ||
        (json['source'] is Map && (json['source'] as Map).containsKey('name'));

    if (!isNewsApi && (json.containsKey('createdAt') || (json['author'] is Map))) {
      return NewsItem.fromPostJson(json);
    }

    final id = json['id']?.toString();
    final userId = json['userId']?.toString() ?? json['user_id']?.toString();

    // Standard NewsAPI format
    final sourceName = json['source'] is Map
        ? (json['source']['name']?.toString() ?? '')
        : (json['source']?.toString() ?? '');

    return NewsItem(
      id: id,
      userId: userId,
      source: sourceName.isNotEmpty
          ? sourceName
          : (json['author']?.toString() ?? 'News'),
      timeAgo: _formatTimeAgo(json['publishedAt']?.toString()),
      title: json['title']?.toString() ?? '',
      subtitle: json['description']?.toString() ?? '',
      category: 'business',
      imageUrl: json['urlToImage']?.toString() ?? '',
      url: json['url']?.toString() ?? '',
    );
  }

  /// Parses a backend Post into a NewsItem for display on the feed
  factory NewsItem.fromPostJson(Map<String, dynamic> json) {
    final id = json['id']?.toString();
    final author = json['author'];
    String authorName = 'Community';
    String? authorId;
    if (author is Map<String, dynamic>) {
      authorName = (author['fullName'] ?? author['username'] ?? 'Community').toString();
      authorId = author['id']?.toString();
    } else if (author != null) {
      authorName = author.toString();
    }
    authorId ??= json['userId']?.toString() ?? json['user_id']?.toString();

    final dateStr = (json['createdAt'] ?? json['created_at'])?.toString();
    final title = (json['title'] ?? '').toString();
    final content = (json['content'] ?? json['description'] ?? '').toString();
    final img = (json['imageUrl'] ?? json['image_url'] ?? '').toString();

    final displayTitle = title.isNotEmpty
        ? title
        : (content.length > 60 ? '${content.substring(0, 60)}...' : content);

    return NewsItem(
      id: id,
      userId: authorId,
      source: authorName,
      timeAgo: _formatTimeAgo(dateStr),
      title: displayTitle.isNotEmpty ? displayTitle : 'Post',
      subtitle: content,
      category: 'Community',
      imageUrl: img,
      url: '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'source': source,
      'timeAgo': timeAgo,
      'title': title,
      'subtitle': subtitle,
      'category': category,
      'imageUrl': imageUrl,
      'url': url,
    };
  }

  static String _formatTimeAgo(String? rawDate) {
    if (rawDate == null || rawDate.isEmpty) return '';
    try {
      final dt = DateTime.tryParse(rawDate);
      if (dt != null) {
        final diff = DateTime.now().toUtc().difference(dt.toUtc());
        if (diff.inSeconds < 60) return 'Just now';
        if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
        if (diff.inHours < 24) return '${diff.inHours}h ago';
        if (diff.inDays < 7) return '${diff.inDays}d ago';
        return '${dt.toLocal()}'.split(' ')[0];
      }
      return rawDate.length >= 10 ? rawDate.substring(0, 10) : rawDate;
    } catch (_) {
      return rawDate.length >= 10 ? rawDate.substring(0, 10) : rawDate;
    }
  }
}
