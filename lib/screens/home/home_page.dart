import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'top_app_bar.dart';
import 'create_post_box.dart';
import 'news_card.dart';
import 'bottom_nav.dart';

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

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  late Future<List<NewsItem>> _newsFuture;

  @override
  void initState() {
    super.initState();
    _newsFuture = _loadNews();
  }

  Future<List<NewsItem>> _loadNews() async {
    final jsonStr = await rootBundle.loadString('assets/news_share.json');
    final List<dynamic> data = json.decode(jsonStr) as List<dynamic>;
    return data
        .map((e) => NewsItem.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  int _currentIndex = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(70),
        child: const TopAppBar(),
      ),
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const CreatePostBox(),
            Expanded(
              child: FutureBuilder<List<NewsItem>>(
                future: _newsFuture,
                builder: (context, snapshot) {
                  if (snapshot.connectionState == ConnectionState.waiting) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  if (snapshot.hasError) {
                    return const Center(child: Text('Failed to load news'));
                  }
                  final items = snapshot.data ?? [];
                  return ListView.builder(
                    padding: const EdgeInsets.only(top: 8),
                    itemCount: items.length,
                    itemBuilder: (context, index) {
                      return NewsCard(item: items[index]);
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: BottomNavBar(
        currentIndex: _currentIndex,
        onChanged: (i) => setState(() => _currentIndex = i),
      ),
    );
  }
}
