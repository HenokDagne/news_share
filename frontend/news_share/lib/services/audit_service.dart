import 'dart:convert';
import 'package:news_share/models/audit_models.dart';
import 'package:news_share/services/api_client.dart';

class AuditService {
  AuditService._();
  static final AuditService instance = AuditService._();

  final ApiClient _api = ApiClient.instance;

  Map<String, dynamic> _toMap(dynamic res) {
    if (res is Map<String, dynamic>) return res;
    if (res is String) {
      try {
        final decoded = jsonDecode(res);
        if (decoded is Map<String, dynamic>) return decoded;
      } catch (_) {}
    }
    return {};
  }

  Future<AuditDashboardModel> getDashboard() async {
    final response = await _api.get('audit/dashboard');
    final data = _toMap(response);
    return AuditDashboardModel.fromJson(data);
  }

  Future<List<AuditLogModel>> getAuditLogs({
    String? category,
    String? severity,
    String? action,
    String? username,
    bool decrypt = false,
    int limit = 50,
    int offset = 0,
  }) async {
    final queryParams = <String, String>{
      'limit': limit.toString(),
      'offset': offset.toString(),
      'decrypt': decrypt.toString(),
    };
    if (category != null && category.isNotEmpty) queryParams['category'] = category;
    if (severity != null && severity.isNotEmpty) queryParams['severity'] = severity;
    if (action != null && action.isNotEmpty) queryParams['action'] = action;
    if (username != null && username.isNotEmpty) queryParams['username'] = username;

    final query = queryParams.entries.map((e) => '${e.key}=${Uri.encodeComponent(e.value)}').join('&');
    final response = await _api.get('audit/logs?$query');
    final data = _toMap(response);
    final items = data['items'] as List<dynamic>? ?? [];
    return items.map((item) => AuditLogModel.fromJson(item as Map<String, dynamic>)).toList();
  }

  Future<IntegrityCheckReportModel> verifyIntegrity() async {
    final response = await _api.post('audit/integrity/verify', body: {});
    final data = _toMap(response);
    return IntegrityCheckReportModel.fromJson(data);
  }

  Future<IntegrityCheckReportModel> verifyLogIntegrity() => verifyIntegrity();

  Future<List<SecurityAlertModel>> getAlerts({
    String? status,
    String? severity,
    int limit = 50,
  }) async {
    final queryParams = <String, String>{
      'limit': limit.toString(),
    };
    if (status != null && status.isNotEmpty) queryParams['status'] = status;
    if (severity != null && severity.isNotEmpty) queryParams['severity'] = severity;

    final query = queryParams.entries.map((e) => '${e.key}=${Uri.encodeComponent(e.value)}').join('&');
    final response = await _api.get('audit/alerts?$query');
    final data = _toMap(response);
    final items = data['items'] as List<dynamic>? ?? [];
    return items.map((item) => SecurityAlertModel.fromJson(item as Map<String, dynamic>)).toList();
  }

  Future<SecurityAlertModel> acknowledgeAlert(String alertId) async {
    final response = await _api.patch('audit/alerts/$alertId/acknowledge', body: {});
    final data = _toMap(response);
    return SecurityAlertModel.fromJson(data);
  }

  Future<SecurityAlertModel> resolveAlert(String alertId, String resolutionNotes) async {
    final response = await _api.patch('audit/alerts/$alertId/resolve', body: {
      'resolutionNotes': resolutionNotes,
    });
    final data = _toMap(response);
    return SecurityAlertModel.fromJson(data);
  }

  Future<Map<String, dynamic>> enforceRetention({int retentionDays = 90}) async {
    final response = await _api.post('audit/retention/enforce', body: {
      'retentionDays': retentionDays,
    });
    return _toMap(response);
  }

  Future<dynamic> exportLogs({String format = 'json', int limit = 100}) async {
    return await _api.get('audit/export?format=$format&limit=$limit');
  }
}
