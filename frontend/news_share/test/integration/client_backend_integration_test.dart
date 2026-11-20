import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';

import 'package:news_share/services/api_client.dart';
import 'package:news_share/services/news_service.dart';
import 'package:news_share/models/news_item.dart';
import 'package:news_share/screens/post/post_service.dart';
import 'package:news_share/screens/post/post_fetcher.dart';
import 'package:news_share/screens/post/delete_post.dart';
import 'package:news_share/screens/users/user_fetcher.dart';
import 'package:news_share/screens/users/follow_handler.dart';
import 'package:news_share/screens/notification/notification.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  // Use 6-digit timestamp suffix so username is <= 20 chars (e.g. "usr_a_123456" = 12 chars)
  final ts = (DateTime.now().millisecondsSinceEpoch % 1000000).toString();
  final userAEmail = 'client_a_$ts@test.com';
  final userAUsername = 'usr_a_$ts';
  final userAPassword = 'Password123!';

  final userBEmail = 'client_b_$ts@test.com';
  final userBUsername = 'usr_b_$ts';
  final userBPassword = 'Password123!';

  late CurrentUserModel userA;
  late CurrentUserModel userB;
  String? createdPostId;

  setUpAll(() async {
    HttpOverrides.global = null;
    SharedPreferences.setMockInitialValues({});
    try {
      await dotenv.load(fileName: '.env');
    } catch (_) {}
    await ApiClient.instance.init();
  });

  group('Mobile Client & NestJS Backend Integration Tests', () {
    test('1. Guest State - ApiClient is unauthenticated initially', () {
      expect(ApiClient.instance.isAuthenticated, isFalse);
      expect(ApiClient.instance.currentUser, isNull);
      expect(ApiClient.instance.currentUserId, isNull);
    });

    test('2. Auth Flow - User A registration & CurrentUserModel parsing', () async {
      userA = await ApiClient.instance.register(
        email: userAEmail,
        password: userAPassword,
        username: userAUsername,
        fullName: 'Client User A',
      );

      expect(userA.id, isNotEmpty);
      expect(userA.email, equals(userAEmail));
      expect(userA.username, equals(userAUsername));
      expect(userA.fullName, equals('Client User A'));
      expect(ApiClient.instance.isAuthenticated, isTrue);
      expect(ApiClient.instance.currentUserId, equals(userA.id));
    });

    test('3. Profile Endpoint - Fetch profile with getMe() and updateProfile()', () async {
      final me = await ApiClient.instance.getMe();
      expect(me.id, equals(userA.id));
      expect(me.username, equals(userAUsername));

      final updated = await ApiClient.instance.updateProfile(
        bio: 'Automated Flutter Client Integration Test Bio',
      );
      expect(updated.bio, equals('Automated Flutter Client Integration Test Bio'));
      expect(ApiClient.instance.currentUser?.bio, equals('Automated Flutter Client Integration Test Bio'));
    });

    test('4. Feed & Posts - Authenticated User A fetches initial timeline', () async {
      final posts = await ApiClient.instance.getPosts(limit: 5);
      expect(posts, isA<List<Map<String, dynamic>>>());

      final news = await NewsService().fetchNews();
      expect(news, isA<List<NewsItem>>());
    });

    test('5. Second User Registration - Register User B', () async {
      await ApiClient.instance.logout();
      expect(ApiClient.instance.isAuthenticated, isFalse);

      userB = await ApiClient.instance.register(
        email: userBEmail,
        password: userBPassword,
        username: userBUsername,
        fullName: 'Client User B',
      );

      expect(userB.id, isNotEmpty);
      expect(userB.id, isNot(equals(userA.id)));
      expect(ApiClient.instance.currentUserId, equals(userB.id));
    });

    test('6. Post Creation via PostService - User B creates a post with image', () async {
      final imageFile = File('assets/images/google_logo.png');
      expect(imageFile.existsSync(), isTrue);

      final postService = PostService();
      final success = await postService.createPost(
        title: 'Flutter Integration Test Headline',
        content: 'This post is created via PostService to verify backend consumption.',
        imageFile: imageFile,
      );

      expect(success, isTrue, reason: postService.lastError);
    });

    test('7. Post Consumption via PostFetcher - Post is listed in PostListPage pipeline', () async {
      final posts = await PostFetcher().fetchPosts();
      expect(posts, isNotEmpty);

      final matching = posts.firstWhere(
        (p) => p['title'] == 'Flutter Integration Test Headline',
        orElse: () => <String, dynamic>{},
      );

      expect(matching, isNotEmpty);
      expect(matching['content'], equals('This post is created via PostService to verify backend consumption.'));
      expect(matching['imageUrl'], isNotNull);
      expect(matching['user_id'], equals(userB.id));
      createdPostId = matching['id']?.toString();
      expect(createdPostId, isNotNull);
    });

    test('8. Home Feed Consumption via NewsService - Post is parsed into NewsItem', () async {
      final newsItems = await NewsService().fetchNews();
      expect(newsItems, isNotEmpty);

      final item = newsItems.firstWhere(
        (n) => n.title == 'Flutter Integration Test Headline',
        orElse: () => NewsItem(
          source: '',
          timeAgo: '',
          title: '',
          subtitle: '',
          category: '',
          imageUrl: '',
          url: '',
        ),
      );

      expect(item.title, equals('Flutter Integration Test Headline'));
      expect(item.subtitle, contains('This post is created via PostService'));
      expect(item.category, equals('Community'));
      expect(item.timeAgo, isNotEmpty);
    });

    test('9. User Directory & Follow Operations - User A follows User B', () async {
      // Switch session back to User A
      await ApiClient.instance.login(email: userAEmail, password: userAPassword);
      expect(ApiClient.instance.currentUserId, equals(userA.id));

      // UserFetcher lists User B and excludes self (User A)
      final users = await UserFetcher().fetchUsers();
      expect(users, isNotEmpty);
      final hasSelf = users.any((u) => u.id == userA.id);
      expect(hasSelf, isFalse);

      final foundUserB = users.firstWhere((u) => u.id == userB.id);
      expect(foundUserB.full_name, equals('Client User B'));

      // Follow User B
      final followHandler = FollowHandler();
      await followHandler.follow(userB.id);

      // Verify follow status
      final isNowFollowing = await followHandler.isFollowing(userB.id);
      expect(isNowFollowing, isTrue);

      // Verify follower count of User B
      final counts = await followHandler.fetchFollowCounts(userB.id);
      expect(counts['followers_count'], greaterThanOrEqualTo(1));
    });

    test('10. Personal Feed Endpoint - User A personal feed contains followed User B post', () async {
      final feedPosts = await ApiClient.instance.getFeed();
      expect(feedPosts, isNotEmpty);

      final matching = feedPosts.firstWhere(
        (p) => p['id'] == createdPostId,
        orElse: () => <String, dynamic>{},
      );
      expect(matching, isNotEmpty);
      expect(matching['title'], equals('Flutter Integration Test Headline'));
    });

    test('11. Notification Consumption - User B receives follow notification', () async {
      // Login as User B
      await ApiClient.instance.login(email: userBEmail, password: userBPassword);
      expect(ApiClient.instance.currentUserId, equals(userB.id));

      // Wait a moment for async event processing
      await Future.delayed(const Duration(milliseconds: 600));

      // Check unread count
      final unreadCount = await ApiClient.instance.getUnreadNotificationCount();
      expect(unreadCount, greaterThanOrEqualTo(1));

      // Read notifications via NotificationData
      final notifications = await NotificationData.readNotifications();
      expect(notifications, isNotEmpty);

      final followNotif = notifications.firstWhere(
        (n) => n.message.toLowerCase().contains('follower') || n.message.toLowerCase().contains('following'),
        orElse: () => NotificationData(id: '', avatar: '', message: '', time: ''),
      );

      expect(followNotif.id, isNotEmpty);
      expect(followNotif.message, isNotEmpty);
      expect(followNotif.actorUsername, equals(userAUsername));

      // Mark notification as read
      await ApiClient.instance.markNotificationRead(followNotif.id);

      // Verify unread count decreases
      final newUnreadCount = await ApiClient.instance.getUnreadNotificationCount();
      expect(newUnreadCount, lessThan(unreadCount));
    });

    test('12. Post Deletion via DeletePostService - User B deletes their post', () async {
      expect(createdPostId, isNotNull);
      await DeletePostService.deletePost(createdPostId!);

      final posts = await PostFetcher().fetchPosts();
      final stillExists = posts.any((p) => p['id'] == createdPostId);
      expect(stillExists, isFalse);
    });

    test('13. Logout Teardown - Session is completely cleared', () async {
      await ApiClient.instance.logout();
      expect(ApiClient.instance.isAuthenticated, isFalse);
      expect(ApiClient.instance.currentUser, isNull);
      expect(ApiClient.instance.accessToken, isNull);
    });

    test('14. Google OAuth Flow - loginWithGoogle creates user, profile, and issues JWT tokens', () async {
      final googleUserEmail = 'google_user_$ts@gmail.com';
      final googleUser = await ApiClient.instance.loginWithGoogle(
        email: googleUserEmail,
        fullName: 'Google OAuth Test User',
        avatarUrl: 'https://lh3.googleusercontent.com/a/test_avatar.jpg',
      );

      expect(googleUser.id, isNotEmpty);
      expect(googleUser.email, equals(googleUserEmail));
      expect(googleUser.fullName, equals('Google OAuth Test User'));
      expect(googleUser.avatarUrl, equals('https://lh3.googleusercontent.com/a/test_avatar.jpg'));
      expect(ApiClient.instance.isAuthenticated, isTrue);
      expect(ApiClient.instance.accessToken, isNotNull);

      // Verify profile fetch works with the Google session
      final me = await ApiClient.instance.getMe();
      expect(me.email, equals(googleUserEmail));

      // Test subsequent Google login returns existing user without errors
      final returnedUser = await ApiClient.instance.loginWithGoogle(
        email: googleUserEmail,
      );
      expect(returnedUser.id, equals(googleUser.id));

      await ApiClient.instance.logout();
      expect(ApiClient.instance.isAuthenticated, isFalse);
    });
  });
}
