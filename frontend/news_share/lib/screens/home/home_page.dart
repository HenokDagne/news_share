/*
  Home screen with TikTok/Reels style vertical full-screen news feed,
  smooth PageView scrolling, search filter, and bottom navigation.
*/
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle;
import '../../services/news_service.dart';
import '../../models/news_item.dart';
import 'top_app_bar.dart';
import 'news_card.dart';
import '../post/post_page.dart';
import '../notification/notification_page.dart';
import '../profile/profile_page.dart';
import 'bottom_nav.dart';
import '../users/user_list.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  final NewsService _newsService = NewsService();
  final TextEditingController _searchController = TextEditingController();
  final PageController _pageController = PageController();
  late Future<List<NewsItem>> newsFuture;
  int currentIndex = 0;
  String _searchQuery = '';
  bool _isSearchVisible = false;

  @override
  void initState() {
    super.initState();
    newsFuture = _loadNews();
  }

  Future<List<NewsItem>> _loadNews({String query = ''}) async {
    try {
      final items = await _newsService.fetchNews(query: query, requireAuth: false);
      if (items.isNotEmpty) return items;
      return await _loadLocalNews(query: query);
    } catch (e) {
      debugPrint('API failed, using local fallback: $e');
      return _loadLocalNews(query: query);
    }
  }

  Future<List<NewsItem>> _loadLocalNews({String query = ''}) async {
    final jsonStr = await rootBundle.loadString('assets/news_share.json');
    final List<dynamic> data = json.decode(jsonStr) as List<dynamic>;
    final items = data
        .map((e) => NewsItem.fromJson(e as Map<String, dynamic>))
        .toList();
    final q = query.trim().toLowerCase();
    if (q.isEmpty) return items;
    return items.where((item) => _matchesQuery(item, q)).toList();
  }

  bool _matchesQuery(NewsItem item, String q) {
    return item.title.toLowerCase().contains(q) ||
        item.subtitle.toLowerCase().contains(q) ||
        item.source.toLowerCase().contains(q) ||
        item.category.toLowerCase().contains(q);
  }

  void _onSearchChanged(String value) {
    setState(() {
      _searchQuery = value;
      newsFuture = _loadNews(query: _searchQuery);
    });
  }

  void onNavTap(int i) {
    if (i == currentIndex) return;
    switch (i) {
      case 1:
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (context) => const UserListPage()),
        );
        break;
      case 2:
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (context) => const PostPage()),
        );
        break;
      case 3:
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (context) => const NotificationPage()),
        );
        break;
      case 4:
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (context) => const ProfilePage()),
        );
        break;
      default:
        setState(() => currentIndex = i);
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: InstagramTopNavBar(
        pageType: TopNavBarType.home,
        searchController: _searchController,
        onSearchChanged: _onSearchChanged,
        onClearSearch: () => _onSearchChanged(''),
        isSearchExpanded: _isSearchVisible,
        onSearchToggle: () {
          setState(() {
            _isSearchVisible = !_isSearchVisible;
            if (!_isSearchVisible) {
              _searchController.clear();
              _onSearchChanged('');
            }
          });
        },
      ),
      body: Stack(
        children: [
          FutureBuilder<List<NewsItem>>(
            future: newsFuture,
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const Center(
                  child: CircularProgressIndicator(color: Color(0xFF00F2FE)),
                );
              }
              if (snapshot.hasError) {
                return Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.error_outline, size: 56, color: Colors.redAccent),
                      const SizedBox(height: 12),
                      Text(
                        'Failed to load news',
                        style: const TextStyle(color: Colors.white, fontSize: 16),
                      ),
                      const SizedBox(height: 12),
                      ElevatedButton(
                        onPressed: () => setState(() => newsFuture = _loadNews(query: _searchQuery)),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF2563EB),
                          foregroundColor: Colors.white,
                        ),
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                );
              }
              final items = snapshot.data ?? [];
              if (items.isEmpty) {
                return Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.newspaper, size: 64, color: Colors.white38),
                      const SizedBox(height: 16),
                      const Text(
                        'No news stories found',
                        style: TextStyle(color: Colors.white70, fontSize: 16),
                      ),
                      if (_searchQuery.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        TextButton(
                          onPressed: () {
                            setState(() {
                              _searchController.clear();
                              _onSearchChanged('');
                            });
                          },
                          child: const Text('Clear search filter'),
                        ),
                      ],
                    ],
                  ),
                );
              }

              // Full-screen TikTok vertical swipe feed
              return RefreshIndicator(
                onRefresh: () async {
                  final updated = _loadNews(query: _searchQuery);
                  setState(() => newsFuture = updated);
                  await updated;
                },
                child: PageView.builder(
                  controller: _pageController,
                  scrollDirection: Axis.vertical,
                  itemCount: items.length,
                  itemBuilder: (context, index) {
                    final item = items[index];
                    return NewsCard(
                      key: ValueKey(item.id ?? '$index-${item.title}'),
                      item: item,
                      onSearchTap: () => setState(() => _isSearchVisible = true),
                      onHidePost: () {
                        setState(() {
                          items.removeAt(index);
                        });
                      },
                    );
                  },
                ),
              );
            },
          ),

          // Floating search toggle button if search is not visible
          if (!_isSearchVisible)
            Positioned(
              top: 14,
              right: 14,
              child: GestureDetector(
                onTap: () => setState(() => _isSearchVisible = true),
                child: Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: Colors.black.withOpacity(0.4),
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white24, width: 1),
                  ),
                  child: const Icon(Icons.search, color: Colors.white, size: 20),
                ),
              ),
            ),
        ],
      ),
      bottomNavigationBar: BottomNavBar(
        currentIndex: currentIndex,
        onChanged: onNavTap,
      ),
    );
  }
}
