
Map<String, dynamic> formatNewsArticle(Map<String, dynamic> article) {
  final publishedAt = DateTime.parse(article['publishedAt'] ?? DateTime.now().toIso8601String());
  final now = DateTime.now();
  final diff = now.difference(publishedAt);
  
  String timeAgo;
  if (diff.inDays > 0) timeAgo = '${diff.inDays}d ago';
  else if (diff.inHours > 0) timeAgo = '${diff.inHours}h ago';
  else if (diff.inMinutes > 0) timeAgo = '${diff.inMinutes}m ago';
  else timeAgo = 'Just now';
  
  // ✅ Raw NewsAPI format - NO likes/comments transformation
  return {
    'source': {
      'id': safeString(article['source']['id'] ?? ''),
      'name': safeString(article['source']['name'] ?? 'Unknown'),
    },
    'author': safeString(article['author'] ?? ''),
    'title': safeTruncate(safeString(article['title'] ?? 'No title'), 100),
    'description': safeString(article['description'] ?? ''),
    'url': safeString(article['url'] ?? ''),
    'urlToImage': safeString(article['urlToImage'] ?? ''),  // ✅ Fixed: urlToImage
    'publishedAt': article['publishedAt'] ?? DateTime.now().toIso8601String(),
    'content': safeTruncate(safeString(article['content'] ?? ''), 200),
    'timeAgo': timeAgo,  // ✅ Custom field for UIhow
    'shares': 0,  // ✅ Placeholder for shares
    'likes': 0,   // ✅ Placeholder for likes
    'comments': "", // ✅ Placeholder for comments
  };
}

String safeString(dynamic value, [int maxLength = 1000]) {
  if (value == null) return '';
  final str = value.toString();
  if (str.isEmpty) return '';
  return str.length > maxLength ? str.substring(0, maxLength) : str;
}

String safeTruncate(String str, int maxLength) {
  if (str.isEmpty || str.length <= maxLength) return str;
  return '${str.substring(0, maxLength)}...';
}
