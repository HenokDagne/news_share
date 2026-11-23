import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:shared_preferences/shared_preferences.dart';

class CurrentUserModel {
  final String id;
  final String email;
  final String username;
  final String role;
  final String? fullName;
  final String? avatarUrl;
  final String? bio;
  final int followersCount;
  final int followingCount;

  CurrentUserModel({
    required this.id,
    required this.email,
    required this.username,
    this.role = 'USER',
    this.fullName,
    this.avatarUrl,
    this.bio,
    this.followersCount = 0,
    this.followingCount = 0,
  });

  factory CurrentUserModel.fromJson(Map<String, dynamic> json) {
    return CurrentUserModel(
      id: json['id']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      username: json['username']?.toString() ?? '',
      role: json['role']?.toString() ?? 'USER',
      fullName: json['fullName']?.toString() ?? json['full_name']?.toString(),
      avatarUrl: json['avatarUrl']?.toString() ?? json['avatar_url']?.toString(),
      bio: json['bio']?.toString(),
      followersCount: (json['followersCount'] ?? json['followers_count'] ?? 0) as int,
      followingCount: (json['followingCount'] ?? json['following_count'] ?? 0) as int,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'email': email,
    'username': username,
    'role': role,
    'fullName': fullName,
    'avatarUrl': avatarUrl,
    'bio': bio,
    'followersCount': followersCount,
    'followingCount': followingCount,
  };
}

class ApiException implements Exception {
  final int statusCode;
  final String message;
  final String error;
  final String? code;
  final Map<String, dynamic>? restriction;

  ApiException({
    required this.statusCode,
    required this.message,
    this.error = '',
    this.code,
    this.restriction,
  });

  @override
  String toString() => message;
}

class ApiClient {
  static final ApiClient instance = ApiClient._internal();
  ApiClient._internal();

  String? _accessToken;
  String? _refreshToken;
  CurrentUserModel? _currentUser;
  bool _initialized = false;

  String get baseUrl {
    final url = dotenv.env['API_BASE_URL'];
    if (url != null && url.isNotEmpty) {
      return url.endsWith('/') ? url.substring(0, url.length - 1) : url;
    }
    // Default fallback
    return 'http://localhost:3000/api/v1';
  }

  bool get isAuthenticated => _accessToken != null && _currentUser != null;
  String? get currentUserId => _currentUser?.id;
  String? get currentUserEmail => _currentUser?.email;
  CurrentUserModel? get currentUser => _currentUser;
  String? get accessToken => _accessToken;

  Future<void> init() async {
    if (_initialized) return;
    try {
      final prefs = await SharedPreferences.getInstance();
      _accessToken = prefs.getString('news_share_access_token');
      _refreshToken = prefs.getString('news_share_refresh_token');
      final userJson = prefs.getString('news_share_current_user');
      if (userJson != null) {
        _currentUser = CurrentUserModel.fromJson(jsonDecode(userJson));
      }
      _initialized = true;
    } catch (e) {
      debugPrint('ApiClient.init error: $e');
    }
  }

  Future<void> _saveSession(String access, String refresh, CurrentUserModel user) async {
    _accessToken = access;
    _refreshToken = refresh;
    _currentUser = user;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('news_share_access_token', access);
      await prefs.setString('news_share_refresh_token', refresh);
      await prefs.setString('news_share_current_user', jsonEncode(user.toJson()));
    } catch (e) {
      debugPrint('Error saving session: $e');
    }
  }

  Future<void> _clearSession() async {
    _accessToken = null;
    _refreshToken = null;
    _currentUser = null;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('news_share_access_token');
      await prefs.remove('news_share_refresh_token');
      await prefs.remove('news_share_current_user');
    } catch (e) {
      debugPrint('Error clearing session: $e');
    }
  }

  Map<String, String> _headers({bool requiresAuth = true, String? contentType}) {
    final headers = <String, String>{
      'Accept': 'application/json',
    };
    if (contentType != null) {
      headers['Content-Type'] = contentType;
    }
    if (requiresAuth && _accessToken != null) {
      headers['Authorization'] = 'Bearer $_accessToken';
    }
    return headers;
  }

  Future<dynamic> _sendRequest(
    String method,
    String endpoint, {
    Map<String, dynamic>? body,
    bool requiresAuth = true,
    bool retryOn401 = true,
  }) async {
    final uri = Uri.parse('$baseUrl$endpoint');
    http.Response response;

    final bodyJson = body != null ? jsonEncode(body) : null;
    final headers = _headers(
      requiresAuth: requiresAuth,
      contentType: bodyJson != null ? 'application/json' : null,
    );

    try {
      switch (method.toUpperCase()) {
        case 'GET':
          response = await http.get(uri, headers: headers);
          break;
        case 'POST':
          response = await http.post(uri, headers: headers, body: bodyJson);
          break;
        case 'PATCH':
          response = await http.patch(uri, headers: headers, body: bodyJson);
          break;
        case 'PUT':
          response = await http.put(uri, headers: headers, body: bodyJson);
          break;
        case 'DELETE':
          response = await http.delete(uri, headers: headers, body: bodyJson);
          break;
        default:
          throw ApiException(statusCode: 400, message: 'Unsupported HTTP method: $method');
      }
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(statusCode: 0, message: 'Network connection failed: $e');
    }

    // Handle token expiration & automatic rotation (FR-AUTH-07)
    if (response.statusCode == 401 && requiresAuth && retryOn401 && _refreshToken != null) {
      final refreshed = await _tryRefreshToken();
      if (refreshed) {
        return _sendRequest(
          method,
          endpoint,
          body: body,
          requiresAuth: requiresAuth,
          retryOn401: false,
        );
      } else {
        await _clearSession();
        throw ApiException(statusCode: 401, message: 'Session expired. Please log in again.');
      }
    }

    return _parseResponse(response);
  }

  dynamic _parseResponse(http.Response response) {
    if (response.statusCode == 204) {
      return null;
    }

    dynamic jsonBody;
    try {
      jsonBody = jsonDecode(response.body);
    } catch (_) {
      jsonBody = null;
    }

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return jsonBody;
    }

    String errorMsg = 'Request failed';
    String errorType = '';
    String? code;
    Map<String, dynamic>? restriction;
    if (jsonBody is Map<String, dynamic>) {
      if (jsonBody['message'] is List) {
        errorMsg = (jsonBody['message'] as List).join(', ');
      } else if (jsonBody['message'] != null) {
        errorMsg = jsonBody['message'].toString();
      }
      errorType = jsonBody['error']?.toString() ?? '';
      code = jsonBody['code']?.toString();
      if (jsonBody['restriction'] is Map<String, dynamic>) {
        restriction = jsonBody['restriction'] as Map<String, dynamic>;
      }
    }

    throw ApiException(
      statusCode: response.statusCode,
      message: errorMsg,
      error: errorType,
      code: code,
      restriction: restriction,
    );
  }

  Future<bool> _tryRefreshToken() async {
    if (_refreshToken == null) return false;
    try {
      final uri = Uri.parse('$baseUrl/auth/refresh');
      final res = await http.post(
        uri,
        headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
        body: jsonEncode({'refreshToken': _refreshToken}),
      );
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        final newAccess = data['accessToken'] as String;
        final newRefresh = data['refreshToken'] as String;
        final user = CurrentUserModel.fromJson(data['profile']);
        await _saveSession(newAccess, newRefresh, user);
        return true;
      }
    } catch (e) {
      debugPrint('Token refresh failed: $e');
    }
    return false;
  }

  // Generic HTTP helpers
  Future<dynamic> get(String endpoint, {bool requiresAuth = true}) =>
      _sendRequest('GET', endpoint, requiresAuth: requiresAuth);

  Future<dynamic> post(String endpoint, {Map<String, dynamic>? body, bool requiresAuth = true}) =>
      _sendRequest('POST', endpoint, body: body, requiresAuth: requiresAuth);

  Future<dynamic> patch(String endpoint, {Map<String, dynamic>? body, bool requiresAuth = true}) =>
      _sendRequest('PATCH', endpoint, body: body, requiresAuth: requiresAuth);

  Future<dynamic> put(String endpoint, {Map<String, dynamic>? body, bool requiresAuth = true}) =>
      _sendRequest('PUT', endpoint, body: body, requiresAuth: requiresAuth);

  Future<dynamic> delete(String endpoint, {Map<String, dynamic>? body, bool requiresAuth = true}) =>
      _sendRequest('DELETE', endpoint, body: body, requiresAuth: requiresAuth);

  // ===================== AUTH =====================

  Future<CurrentUserModel> register({
    required String email,
    required String password,
    required String username,
    String? fullName,
  }) async {
    final res = await _sendRequest(
      'POST',
      '/auth/register',
      body: {
        'email': email.trim().toLowerCase(),
        'password': password,
        'username': username.trim(),
        if (fullName != null && fullName.trim().isNotEmpty) 'fullName': fullName.trim(),
        'acceptTerms': true,
      },
      requiresAuth: false,
    );

    // If backend provided verificationToken (e.g. in test/dev), auto-activate
    if (res['accessToken'] == null && res['verificationToken'] != null) {
      try {
        final verifiedUser = await verifyEmail(token: res['verificationToken'].toString());
        return verifiedUser;
      } catch (e) {
        debugPrint('Auto-verify test fallback: $e');
      }
    }

    final user = CurrentUserModel.fromJson(res['profile']);
    if (res['accessToken'] != null && res['refreshToken'] != null) {
      await _saveSession(res['accessToken'], res['refreshToken'], user);
    }
    return user;
  }

  Future<CurrentUserModel> verifyEmail({required String token}) async {
    final res = await _sendRequest(
      'POST',
      '/auth/verify-email',
      body: {'token': token.trim()},
      requiresAuth: false,
    );

    if (res['accessToken'] != null && res['profile'] != null) {
      final user = CurrentUserModel.fromJson(res['profile']);
      await _saveSession(res['accessToken'], res['refreshToken'], user);
      return user;
    }
    throw ApiException(statusCode: 400, message: 'Invalid verification response');
  }

  Future<String> resendVerification({required String email}) async {
    final res = await _sendRequest(
      'POST',
      '/auth/resend-verification',
      body: {'email': email.trim().toLowerCase()},
      requiresAuth: false,
    );
    return res?['message']?.toString() ?? 'Verification email sent if account exists';
  }

  Future<String> forgotPassword({required String email}) async {
    final res = await _sendRequest(
      'POST',
      '/auth/forgot-password',
      body: {'email': email.trim().toLowerCase()},
      requiresAuth: false,
    );
    return res?['message']?.toString() ?? 'If the account exists, a reset link was sent.';
  }

  Future<String> resetPassword({
    required String token,
    required String newPassword,
  }) async {
    final res = await _sendRequest(
      'POST',
      '/auth/reset-password',
      body: {
        'token': token.trim(),
        'newPassword': newPassword,
      },
      requiresAuth: false,
    );
    return res?['message']?.toString() ?? 'Password reset successfully.';
  }

  Future<CurrentUserModel> login({
    required String email,
    required String password,
  }) async {
    final res = await _sendRequest(
      'POST',
      '/auth/login',
      body: {
        'email': email.trim().toLowerCase(),
        'password': password,
      },
      requiresAuth: false,
    );

    final user = CurrentUserModel.fromJson(res['profile']);
    await _saveSession(res['accessToken'], res['refreshToken'], user);
    return user;
  }

  Future<CurrentUserModel> loginWithGoogle({
    required String email,
    String? fullName,
    String? avatarUrl,
    String? idToken,
  }) async {
    final res = await _sendRequest(
      'POST',
      '/auth/google',
      body: {
        'email': email.trim().toLowerCase(),
        if (fullName != null && fullName.trim().isNotEmpty) 'fullName': fullName.trim(),
        if (avatarUrl != null && avatarUrl.trim().isNotEmpty) 'avatarUrl': avatarUrl.trim(),
        if (idToken != null && idToken.trim().isNotEmpty) 'idToken': idToken.trim(),
      },
      requiresAuth: false,
    );

    final user = CurrentUserModel.fromJson(res['profile']);
    await _saveSession(res['accessToken'], res['refreshToken'], user);
    return user;
  }

  Future<void> logout() async {
    if (_refreshToken != null) {
      try {
        await _sendRequest('POST', '/auth/logout', body: {'refreshToken': _refreshToken});
      } catch (e) {
        debugPrint('Logout request failed: $e');
      }
    }
    await _clearSession();
  }

  // ===================== USERS & PROFILES =====================

  Future<CurrentUserModel> getMe() async {
    final res = await _sendRequest('GET', '/me');
    final user = CurrentUserModel.fromJson(res);
    _currentUser = user;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('news_share_current_user', jsonEncode(user.toJson()));
    return user;
  }

  Future<CurrentUserModel> updateProfile({
    String? username,
    String? fullName,
    String? bio,
  }) async {
    final body = <String, dynamic>{};
    if (username != null && username.isNotEmpty) body['username'] = username.trim();
    if (fullName != null) body['fullName'] = fullName.trim().isEmpty ? null : fullName.trim();
    if (bio != null) body['bio'] = bio.trim().isEmpty ? null : bio.trim();

    final res = await _sendRequest('PATCH', '/me', body: body);
    final updated = CurrentUserModel.fromJson(res);
    _currentUser = updated;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('news_share_current_user', jsonEncode(updated.toJson()));
    return updated;
  }

  Future<String> uploadAvatar(File file) async {
    final uri = Uri.parse('$baseUrl/me/avatar');
    final request = http.MultipartRequest('PUT', uri);
    if (_accessToken != null) {
      request.headers['Authorization'] = 'Bearer $_accessToken';
    }
    final ext = file.path.split('.').last.toLowerCase();
    final subType = (ext == 'png' || ext == 'webp') ? ext : 'jpeg';
    request.files.add(await http.MultipartFile.fromPath(
      'file',
      file.path,
      contentType: MediaType('image', subType),
    ));

    final streamed = await request.send();
    final res = await http.Response.fromStream(streamed);
    final data = _parseResponse(res);
    final avatarUrl = data['avatarUrl'] as String;

    if (_currentUser != null) {
      _currentUser = CurrentUserModel(
        id: _currentUser!.id,
        email: _currentUser!.email,
        username: _currentUser!.username,
        fullName: _currentUser!.fullName,
        avatarUrl: avatarUrl,
        bio: _currentUser!.bio,
        followersCount: _currentUser!.followersCount,
        followingCount: _currentUser!.followingCount,
      );
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('news_share_current_user', jsonEncode(_currentUser!.toJson()));
    }

    return avatarUrl;
  }

  Future<void> deleteAvatar() async {
    await _sendRequest('DELETE', '/me/avatar');
    if (_currentUser != null) {
      _currentUser = CurrentUserModel(
        id: _currentUser!.id,
        email: _currentUser!.email,
        username: _currentUser!.username,
        fullName: _currentUser!.fullName,
        avatarUrl: null,
        bio: _currentUser!.bio,
        followersCount: _currentUser!.followersCount,
        followingCount: _currentUser!.followingCount,
      );
    }
  }

  Future<List<Map<String, dynamic>>> getUsers({String? search, int limit = 50, String? cursor}) async {
    final queryParams = <String, String>{
      'limit': limit.toString(),
      if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
      if (cursor != null) 'cursor': cursor,
    };
    final uri = Uri.parse('$baseUrl/users').replace(queryParameters: queryParams);
    final res = await http.get(uri, headers: _headers());
    final data = _parseResponse(res);
    if (data is Map && data['data'] is List) {
      return List<Map<String, dynamic>>.from(data['data']);
    }
    if (data is Map && data['items'] is List) {
      return List<Map<String, dynamic>>.from(data['items']);
    }
    if (data is List) {
      return List<Map<String, dynamic>>.from(data);
    }
    return [];
  }

  Future<Map<String, dynamic>> getUserProfile(String userId) async {
    final res = await _sendRequest('GET', '/users/$userId');
    return Map<String, dynamic>.from(res);
  }

  // ===================== POSTS =====================

  Future<Map<String, dynamic>> createPost({
    String? title,
    String? content,
    File? image,
  }) async {
    final uri = Uri.parse('$baseUrl/posts');
    final request = http.MultipartRequest('POST', uri);
    if (_accessToken != null) {
      request.headers['Authorization'] = 'Bearer $_accessToken';
    }

    if (title != null && title.trim().isNotEmpty) {
      request.fields['title'] = title.trim();
    }
    if (content != null && content.trim().isNotEmpty) {
      request.fields['content'] = content.trim();
    }
    if (image != null) {
      final ext = image.path.split('.').last.toLowerCase();
      final subType = (ext == 'png' || ext == 'webp') ? ext : 'jpeg';
      request.files.add(await http.MultipartFile.fromPath(
        'image',
        image.path,
        contentType: MediaType('image', subType),
      ));
    }

    final streamed = await request.send();
    final res = await http.Response.fromStream(streamed);
    return _parseResponse(res);
  }

  Future<List<Map<String, dynamic>>> getFeed({int limit = 20, String? cursor}) async {
    final queryParams = <String, String>{
      'limit': limit.toString(),
      if (cursor != null) 'cursor': cursor,
    };
    final uri = Uri.parse('$baseUrl/feed').replace(queryParameters: queryParams);
    final res = await http.get(uri, headers: _headers());
    final data = _parseResponse(res);
    if (data is Map && data['data'] is List) {
      return List<Map<String, dynamic>>.from(data['data']);
    }
    if (data is Map && data['items'] is List) {
      return List<Map<String, dynamic>>.from(data['items']);
    }
    if (data is List) {
      return List<Map<String, dynamic>>.from(data);
    }
    return [];
  }

  Future<List<Map<String, dynamic>>> getPosts({int limit = 50, String? cursor}) async {
    final queryParams = <String, String>{
      'limit': limit.toString(),
      if (cursor != null) 'cursor': cursor,
    };
    final uri = Uri.parse('$baseUrl/posts').replace(queryParameters: queryParams);
    final res = await http.get(uri, headers: _headers());
    final data = _parseResponse(res);
    if (data is Map && data['data'] is List) {
      return List<Map<String, dynamic>>.from(data['data']);
    }
    if (data is Map && data['items'] is List) {
      return List<Map<String, dynamic>>.from(data['items']);
    }
    if (data is List) {
      return List<Map<String, dynamic>>.from(data);
    }
    return [];
  }

  Future<List<Map<String, dynamic>>> getUserPosts(String userId, {int limit = 50, String? cursor}) async {
    final queryParams = <String, String>{
      'limit': limit.toString(),
      if (cursor != null) 'cursor': cursor,
    };
    final uri = Uri.parse('$baseUrl/users/$userId/posts').replace(queryParameters: queryParams);
    final res = await http.get(uri, headers: _headers());
    final data = _parseResponse(res);
    if (data is Map && data['data'] is List) {
      return List<Map<String, dynamic>>.from(data['data']);
    }
    if (data is Map && data['items'] is List) {
      return List<Map<String, dynamic>>.from(data['items']);
    }
    if (data is List) {
      return List<Map<String, dynamic>>.from(data);
    }
    return [];
  }

  Future<void> deletePost(String postId) async {
    await _sendRequest('DELETE', '/posts/$postId');
  }

  // ===================== LIKES =====================

  Future<Map<String, dynamic>> likePost(String postId) async {
    final res = await _sendRequest('POST', '/posts/$postId/like');
    return Map<String, dynamic>.from(res is Map ? res : {});
  }

  Future<Map<String, dynamic>> unlikePost(String postId) async {
    final res = await _sendRequest('DELETE', '/posts/$postId/like');
    return Map<String, dynamic>.from(res is Map ? res : {});
  }

  // ===================== COMMENTS =====================

  Future<List<Map<String, dynamic>>> getComments(String postId, {int limit = 50, String? cursor}) async {
    final queryParams = <String, String>{
      'limit': limit.toString(),
      if (cursor != null) 'cursor': cursor,
    };
    final uri = Uri.parse('$baseUrl/posts/$postId/comments').replace(queryParameters: queryParams);
    final res = await http.get(uri, headers: _headers());
    final data = _parseResponse(res);
    if (data is Map && data['data'] is List) {
      return List<Map<String, dynamic>>.from(data['data']);
    }
    if (data is Map && data['items'] is List) {
      return List<Map<String, dynamic>>.from(data['items']);
    }
    if (data is List) {
      return List<Map<String, dynamic>>.from(data);
    }
    return [];
  }

  Future<Map<String, dynamic>> addComment(String postId, String content) async {
    final res = await _sendRequest('POST', '/posts/$postId/comments', body: {
      'content': content.trim(),
    });
    return Map<String, dynamic>.from(res is Map ? res : {});
  }

  Future<void> deleteComment(String commentId) async {
    await _sendRequest('DELETE', '/comments/$commentId');
  }

  // ===================== FOLLOWS =====================

  Future<bool> follow(String targetUserId) async {
    final res = await _sendRequest('POST', '/users/$targetUserId/follow');
    return res != null && res['following'] == true;
  }

  Future<bool> unfollow(String targetUserId) async {
    final res = await _sendRequest('DELETE', '/users/$targetUserId/follow');
    return res != null && res['following'] == false;
  }

  Future<Map<String, bool>> getFollowStatus(String targetUserId) async {
    final res = await _sendRequest('GET', '/users/$targetUserId/follow-status');
    return {
      'isFollowing': res['isFollowing'] == true,
      'isFollowedBy': res['isFollowedBy'] == true,
    };
  }

  Future<List<Map<String, dynamic>>> getFollowers(String targetUserId, {int limit = 50, String? cursor}) async {
    final queryParams = <String, String>{
      'limit': limit.toString(),
      if (cursor != null) 'cursor': cursor,
    };
    final uri = Uri.parse('$baseUrl/users/$targetUserId/followers').replace(queryParameters: queryParams);
    final res = await http.get(uri, headers: _headers());
    final data = _parseResponse(res);
    if (data is Map && data['data'] is List) {
      return List<Map<String, dynamic>>.from(data['data']);
    }
    if (data is Map && data['items'] is List) {
      return List<Map<String, dynamic>>.from(data['items']);
    }
    if (data is List) {
      return List<Map<String, dynamic>>.from(data);
    }
    return [];
  }

  Future<List<Map<String, dynamic>>> getFollowing(String targetUserId, {int limit = 50, String? cursor}) async {
    final queryParams = <String, String>{
      'limit': limit.toString(),
      if (cursor != null) 'cursor': cursor,
    };
    final uri = Uri.parse('$baseUrl/users/$targetUserId/following').replace(queryParameters: queryParams);
    final res = await http.get(uri, headers: _headers());
    final data = _parseResponse(res);
    if (data is Map && data['data'] is List) {
      return List<Map<String, dynamic>>.from(data['data']);
    }
    if (data is Map && data['items'] is List) {
      return List<Map<String, dynamic>>.from(data['items']);
    }
    if (data is List) {
      return List<Map<String, dynamic>>.from(data);
    }
    return [];
  }

  // ===================== NOTIFICATIONS =====================

  Future<List<Map<String, dynamic>>> getNotifications({bool? unread, int limit = 50, String? cursor}) async {
    final queryParams = <String, String>{
      'limit': limit.toString(),
      if (unread != null) 'unread': unread.toString(),
      if (cursor != null) 'cursor': cursor,
    };
    final uri = Uri.parse('$baseUrl/notifications').replace(queryParameters: queryParams);
    final res = await http.get(uri, headers: _headers());
    final data = _parseResponse(res);
    if (data is Map && data['data'] is List) {
      return List<Map<String, dynamic>>.from(data['data']);
    }
    if (data is Map && data['items'] is List) {
      return List<Map<String, dynamic>>.from(data['items']);
    }
    if (data is List) {
      return List<Map<String, dynamic>>.from(data);
    }
    return [];
  }

  Future<int> getUnreadNotificationCount() async {
    final res = await _sendRequest('GET', '/notifications/unread-count');
    return (res['count'] ?? 0) as int;
  }

  Future<void> markNotificationRead(String id) async {
    await _sendRequest('PATCH', '/notifications/$id/read');
  }

  Future<int> markAllNotificationsRead() async {
    final res = await _sendRequest('POST', '/notifications/read-all');
    return (res['updated'] ?? 0) as int;
  }

  Future<void> deleteNotification(String id) async {
    await _sendRequest('DELETE', '/notifications/$id');
  }

  // ===================== REPORTING & MODERATION =====================

  Future<List<Map<String, dynamic>>> getReportReasons() async {
    final res = await _sendRequest('GET', '/report-reasons', requiresAuth: false);
    if (res is List) {
      return List<Map<String, dynamic>>.from(res);
    }
    return [];
  }

  Future<Map<String, dynamic>> reportPost(
    String postId, {
    required String reason,
    String? details,
  }) async {
    final res = await _sendRequest(
      'POST',
      '/posts/$postId/report',
      body: {
        'reason': reason,
        if (details != null && details.isNotEmpty) 'details': details,
      },
    );
    return res is Map<String, dynamic> ? res : {'status': 'RECEIVED'};
  }

  Future<Map<String, dynamic>> reportUser(
    String userId, {
    required String reason,
    String? details,
  }) async {
    final res = await _sendRequest(
      'POST',
      '/users/$userId/report',
      body: {
        'reason': reason,
        if (details != null && details.isNotEmpty) 'details': details,
      },
    );
    return res is Map<String, dynamic> ? res : {'status': 'RECEIVED'};
  }

  // ===================== PREFERENCES (NOT INTERESTED & SAVE) =====================

  Future<void> setNotInterested(String postId) async {
    await _sendRequest('POST', '/posts/$postId/not-interested');
  }

  Future<void> undoNotInterested(String postId) async {
    await _sendRequest('DELETE', '/posts/$postId/not-interested');
  }

  Future<void> savePost(String postId) async {
    await _sendRequest('POST', '/posts/$postId/save');
  }

  Future<void> unsavePost(String postId) async {
    await _sendRequest('DELETE', '/posts/$postId/save');
  }

  Future<List<Map<String, dynamic>>> getSavedPosts({int limit = 50, String? cursor}) async {
    final queryParams = <String, String>{
      'limit': limit.toString(),
      if (cursor != null) 'cursor': cursor,
    };
    final uri = Uri.parse('$baseUrl/me/saved').replace(queryParameters: queryParams);
    final res = await http.get(uri, headers: _headers());
    final data = _parseResponse(res);
    if (data is Map && data['data'] is List) {
      return List<Map<String, dynamic>>.from(data['data']);
    }
    if (data is Map && data['items'] is List) {
      return List<Map<String, dynamic>>.from(data['items']);
    }
    if (data is List) {
      return List<Map<String, dynamic>>.from(data);
    }
    return [];
  }

  // ===================== PERSONAL ACTIVITY & ACCOUNT STATUS =====================

  Future<Map<String, dynamic>> getAccountStatus() async {
    final res = await _sendRequest('GET', '/me/account-status');
    return res is Map<String, dynamic> ? res : {};
  }

  Future<List<Map<String, dynamic>>> getUserActivity({int limit = 50}) async {
    final res = await _sendRequest('GET', '/me/activity?limit=$limit');
    if (res is Map && res['data'] is List) {
      return List<Map<String, dynamic>>.from(res['data']);
    } else if (res is List) {
      return List<Map<String, dynamic>>.from(res);
    }
    return [];
  }

  Future<List<Map<String, dynamic>>> getMyReports({int limit = 50}) async {
    final res = await _sendRequest('GET', '/me/reports?limit=$limit');
    if (res is Map && res['data'] is List) {
      return List<Map<String, dynamic>>.from(res['data']);
    } else if (res is List) {
      return List<Map<String, dynamic>>.from(res);
    }
    return [];
  }

  Future<List<Map<String, dynamic>>> getMyWarnings() async {
    final res = await _sendRequest('GET', '/me/warnings');
    if (res is List) {
      return List<Map<String, dynamic>>.from(res);
    }
    return [];
  }

  Future<void> markActivityRead(String id) async {
    await _sendRequest('POST', '/me/activity/$id/read');
  }

  Future<void> markAllActivityRead() async {
    await _sendRequest('POST', '/me/activity/read-all');
  }

  // ===================== GOVERNANCE, PRIVACY & SAFETY =====================

  Future<List<Map<String, dynamic>>> getActivePolicies() async {
    try {
      final res = await _sendRequest('GET', '/policies/active', requiresAuth: false);
      if (res is List) {
        return List<Map<String, dynamic>>.from(res);
      }
      return [];
    } catch (e) {
      debugPrint('getActivePolicies error: $e');
      return [];
    }
  }

  Future<List<Map<String, dynamic>>> getMyPrivacyRequests() async {
    try {
      final res = await _sendRequest('GET', '/me/privacy/requests');
      if (res is List) {
        return List<Map<String, dynamic>>.from(res);
      }
      return [];
    } catch (e) {
      debugPrint('getMyPrivacyRequests error: $e');
      return [];
    }
  }

  Future<Map<String, dynamic>> submitPrivacyRequest({
    required String requestType,
    required String details,
  }) async {
    final res = await _sendRequest('POST', '/me/privacy/requests', body: {
      'requestType': requestType,
      'details': details,
    });
    return res is Map<String, dynamic> ? res : {};
  }

  Future<Map<String, dynamic>> exportMyData() async {
    final res = await _sendRequest('GET', '/me/privacy/export-data');
    return res is Map<String, dynamic> ? res : {};
  }

  Future<Map<String, dynamic>> recordConsent({
    required String purpose,
    required bool granted,
    String? policyVersion,
  }) async {
    final res = await _sendRequest('POST', '/me/privacy/consent', body: {
      'purpose': purpose,
      'granted': granted,
      if (policyVersion != null) 'policyVersion': policyVersion,
    });
    return res is Map<String, dynamic> ? res : {};
  }

  Future<List<Map<String, dynamic>>> getMyConsents() async {
    try {
      final res = await _sendRequest('GET', '/me/privacy/consents');
      if (res is List) {
        return List<Map<String, dynamic>>.from(res);
      }
      return [];
    } catch (e) {
      debugPrint('getMyConsents error: $e');
      return [];
    }
  }

  Future<List<Map<String, dynamic>>> getBlockedUsers() async {
    try {
      final res = await _sendRequest('GET', '/me/blocks');
      if (res is List) {
        return List<Map<String, dynamic>>.from(res);
      }
      return [];
    } catch (e) {
      debugPrint('getBlockedUsers error: $e');
      return [];
    }
  }

  Future<Map<String, dynamic>> blockUser(String targetUserId, {String? reason}) async {
    final res = await _sendRequest('POST', '/users/$targetUserId/block', body: {
      if (reason != null && reason.isNotEmpty) 'reason': reason,
    });
    return res is Map<String, dynamic> ? res : {};
  }

  Future<void> unblockUser(String targetUserId) async {
    await _sendRequest('DELETE', '/users/$targetUserId/block');
  }
}
