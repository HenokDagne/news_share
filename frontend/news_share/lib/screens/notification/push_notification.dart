/*
  Fetches a user's notifications from the NestJS REST API.
*/
import '../../services/api_client.dart';

class PushNotificationService {
  static Future<List<Map<String, dynamic>>> fetchUserNotifications([
    String? userId,
  ]) async {
    try {
      if (!ApiClient.instance.isAuthenticated) return [];
      return await ApiClient.instance.getNotifications();
    } catch (e) {
      print('Error fetching notifications: $e');
      return [];
    }
  }
}
