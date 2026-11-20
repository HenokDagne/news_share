class NewsItem {
  final String? id;
  final String? userId;
  final String source;
  final String? authorUsername;
  final String? authorAvatarUrl;
  final bool isVerified;
  final String timeAgo;
  final String title;
  final String subtitle;
  final String category;
  final String imageUrl;
  final String url;
  final int likesCount;
  final int commentsCount;
  final int savesCount;
  final int sharesCount;
  final bool isLiked;
  final bool isSaved;
  final bool isFollowing;

  NewsItem({
    this.id,
    this.userId,
    required this.source,
    this.authorUsername,
    this.authorAvatarUrl,
    this.isVerified = true,
    required this.timeAgo,
    required this.title,
    required this.subtitle,
    required this.category,
    required this.imageUrl,
    required this.url,
    this.likesCount = 0,
    this.commentsCount = 0,
    this.savesCount = 0,
    this.sharesCount = 80,
    this.isLiked = false,
    this.isSaved = false,
    this.isFollowing = false,
  });

  NewsItem copyWith({
    String? id,
    String? userId,
    String? source,
    String? authorUsername,
    String? authorAvatarUrl,
    bool? isVerified,
    String? timeAgo,
    String? title,
    String? subtitle,
    String? category,
    String? imageUrl,
    String? url,
    int? likesCount,
    int? commentsCount,
    int? savesCount,
    int? sharesCount,
    bool? isLiked,
    bool? isSaved,
    bool? isFollowing,
  }) {
    return NewsItem(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      source: source ?? this.source,
      authorUsername: authorUsername ?? this.authorUsername,
      authorAvatarUrl: authorAvatarUrl ?? this.authorAvatarUrl,
      isVerified: isVerified ?? this.isVerified,
      timeAgo: timeAgo ?? this.timeAgo,
      title: title ?? this.title,
      subtitle: subtitle ?? this.subtitle,
      category: category ?? this.category,
      imageUrl: imageUrl ?? this.imageUrl,
      url: url ?? this.url,
      likesCount: likesCount ?? this.likesCount,
      commentsCount: commentsCount ?? this.commentsCount,
      savesCount: savesCount ?? this.savesCount,
      sharesCount: sharesCount ?? this.sharesCount,
      isLiked: isLiked ?? this.isLiked,
      isSaved: isSaved ?? this.isSaved,
      isFollowing: isFollowing ?? this.isFollowing,
    );
  }

  /// Accepts either a NestJS backend Post JSON or external NewsAPI JSON
  factory NewsItem.fromJson(Map<String, dynamic> json) {
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
      authorUsername: json['author']?.toString(),
      authorAvatarUrl: null,
      isVerified: true,
      timeAgo: _formatTimeAgo(json['publishedAt']?.toString()),
      title: json['title']?.toString() ?? '',
      subtitle: json['description']?.toString() ?? '',
      category: 'business',
      imageUrl: json['urlToImage']?.toString() ?? '',
      url: json['url']?.toString() ?? '',
      likesCount: 420,
      commentsCount: 120,
      savesCount: 15,
      sharesCount: 80,
      isLiked: false,
      isSaved: false,
      isFollowing: false,
    );
  }

  /// Parses a backend Post into a NewsItem for display on the feed
  factory NewsItem.fromPostJson(Map<String, dynamic> json) {
    final id = json['id']?.toString();
    final author = json['author'];
    String authorName = 'Community';
    String? authorUsername;
    String? authorAvatar;
    String? authorId;

    if (author is Map<String, dynamic>) {
      authorUsername = author['username']?.toString();
      authorName = (author['fullName'] ?? authorUsername ?? 'Community').toString();
      authorAvatar = author['avatarUrl']?.toString();
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

    final isLiked = json['isLiked'] == true;
    final isSaved = json['isSaved'] == true;
    final isFollowing = json['isFollowing'] == true;
    final likesCount = json['likesCount'] is num ? (json['likesCount'] as num).toInt() : 0;
    final commentsCount = json['commentsCount'] is num ? (json['commentsCount'] as num).toInt() : 0;
    final savesCount = json['savesCount'] is num ? (json['savesCount'] as num).toInt() : 0;
    final sharesCount = json['sharesCount'] is num ? (json['sharesCount'] as num).toInt() : 80;

    return NewsItem(
      id: id,
      userId: authorId,
      source: authorName,
      authorUsername: authorUsername ?? authorName,
      authorAvatarUrl: authorAvatar,
      isVerified: true,
      timeAgo: _formatTimeAgo(dateStr),
      title: displayTitle.isNotEmpty ? displayTitle : 'Post',
      subtitle: content,
      category: 'community',
      imageUrl: img,
      url: '',
      likesCount: likesCount,
      commentsCount: commentsCount,
      savesCount: savesCount,
      sharesCount: sharesCount,
      isLiked: isLiked,
      isSaved: isSaved,
      isFollowing: isFollowing,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'userId': userId,
      'source': source,
      'authorUsername': authorUsername,
      'authorAvatarUrl': authorAvatarUrl,
      'timeAgo': timeAgo,
      'title': title,
      'subtitle': subtitle,
      'category': category,
      'imageUrl': imageUrl,
      'url': url,
      'likesCount': likesCount,
      'commentsCount': commentsCount,
      'savesCount': savesCount,
      'sharesCount': sharesCount,
      'isLiked': isLiked,
      'isSaved': isSaved,
      'isFollowing': isFollowing,
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
