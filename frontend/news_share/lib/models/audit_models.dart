class AuditLogModel {
  final String id;
  final String sequenceNumber;
  final DateTime timestamp;
  final String category;
  final String action;
  final String severity;
  final String? username;
  final String? ipAddress;
  final String? resource;
  final String? httpMethod;
  final int? statusCode;
  final int? durationMs;
  final String recordHash;
  final String previousHash;
  final Map<String, dynamic>? decryptedPayload;

  AuditLogModel({
    required this.id,
    required this.sequenceNumber,
    required this.timestamp,
    required this.category,
    required this.action,
    required this.severity,
    this.username,
    this.ipAddress,
    this.resource,
    this.httpMethod,
    this.statusCode,
    this.durationMs,
    required this.recordHash,
    required this.previousHash,
    this.decryptedPayload,
  });

  factory AuditLogModel.fromJson(Map<String, dynamic> json) {
    return AuditLogModel(
      id: json['id']?.toString() ?? '',
      sequenceNumber: json['sequenceNumber']?.toString() ?? '0',
      timestamp: DateTime.tryParse(json['timestamp']?.toString() ?? '') ?? DateTime.now(),
      category: json['category']?.toString() ?? 'USER_ACTIVITY',
      action: json['action']?.toString() ?? '',
      severity: json['severity']?.toString() ?? 'INFO',
      username: json['username']?.toString(),
      ipAddress: json['ipAddress']?.toString(),
      resource: json['resource']?.toString(),
      httpMethod: json['httpMethod']?.toString(),
      statusCode: json['statusCode'] as int?,
      durationMs: json['durationMs'] as int?,
      recordHash: json['recordHash']?.toString() ?? '',
      previousHash: json['previousHash']?.toString() ?? '',
      decryptedPayload: json['decryptedPayload'] as Map<String, dynamic>?,
    );
  }
}

class SecurityAlertModel {
  final String id;
  final DateTime timestamp;
  final String alertType;
  final String severity;
  final String status;
  final String title;
  final String description;
  final String? ipAddress;
  final String? username;
  final String escalationTier;
  final bool notificationSent;
  final DateTime? resolvedAt;
  final String? resolvedBy;
  final String? resolutionNotes;

  SecurityAlertModel({
    required this.id,
    required this.timestamp,
    required this.alertType,
    required this.severity,
    required this.status,
    required this.title,
    required this.description,
    this.ipAddress,
    this.username,
    this.escalationTier = 'TIER_1',
    this.notificationSent = false,
    this.resolvedAt,
    this.resolvedBy,
    this.resolutionNotes,
  });

  factory SecurityAlertModel.fromJson(Map<String, dynamic> json) {
    return SecurityAlertModel(
      id: json['id']?.toString() ?? '',
      timestamp: DateTime.tryParse(json['timestamp']?.toString() ?? '') ?? DateTime.now(),
      alertType: json['alertType']?.toString() ?? '',
      severity: json['severity']?.toString() ?? 'HIGH',
      status: json['status']?.toString() ?? 'OPEN',
      title: json['title']?.toString() ?? '',
      description: json['description']?.toString() ?? '',
      ipAddress: json['ipAddress']?.toString(),
      username: json['username']?.toString(),
      escalationTier: json['escalationTier']?.toString() ?? 'TIER_1',
      notificationSent: json['notificationSent'] == true,
      resolvedAt: json['resolvedAt'] != null ? DateTime.tryParse(json['resolvedAt'].toString()) : null,
      resolvedBy: json['resolvedBy']?.toString(),
      resolutionNotes: json['resolutionNotes']?.toString(),
    );
  }
}

class IntegrityCheckReportModel {
  final bool isValid;
  final int totalRecordsVerified;
  final String genesisHash;
  final String? chainHeadHash;
  final String verifiedAt;
  final Map<String, dynamic>? tamperedRecord;

  IntegrityCheckReportModel({
    required this.isValid,
    required this.totalRecordsVerified,
    required this.genesisHash,
    this.chainHeadHash,
    required this.verifiedAt,
    this.tamperedRecord,
  });

  factory IntegrityCheckReportModel.fromJson(Map<String, dynamic> json) {
    return IntegrityCheckReportModel(
      isValid: json['isValid'] == true,
      totalRecordsVerified: (json['totalRecordsVerified'] ?? 0) as int,
      genesisHash: json['genesisHash']?.toString() ?? '',
      chainHeadHash: json['chainHeadHash']?.toString(),
      verifiedAt: json['verifiedAt']?.toString() ?? '',
      tamperedRecord: json['tamperedRecord'] as Map<String, dynamic>?,
    );
  }
}

class DashboardSummaryModel {
  final int totalLogs;
  final int todayLogs;
  final int failedLogins24h;
  final int openAlerts;
  final int criticalAlerts;

  DashboardSummaryModel({
    required this.totalLogs,
    required this.todayLogs,
    required this.failedLogins24h,
    required this.openAlerts,
    required this.criticalAlerts,
  });

  factory DashboardSummaryModel.fromJson(Map<String, dynamic> json) {
    return DashboardSummaryModel(
      totalLogs: (json['totalLogs'] ?? 0) as int,
      todayLogs: (json['todayLogs'] ?? 0) as int,
      failedLogins24h: (json['failedLogins24h'] ?? 0) as int,
      openAlerts: (json['openAlerts'] ?? 0) as int,
      criticalAlerts: (json['criticalAlerts'] ?? 0) as int,
    );
  }
}

class AuditDashboardModel {
  final DashboardSummaryModel summary;
  final List<Map<String, dynamic>> byCategory;
  final List<Map<String, dynamic>> bySeverity;
  final List<Map<String, dynamic>> topActions;
  final List<Map<String, dynamic>> topIps;

  AuditDashboardModel({
    required this.summary,
    required this.byCategory,
    required this.bySeverity,
    required this.topActions,
    required this.topIps,
  });

  factory AuditDashboardModel.fromJson(Map<String, dynamic> json) {
    final distributions = json['distributions'] as Map<String, dynamic>? ?? {};
    return AuditDashboardModel(
      summary: DashboardSummaryModel.fromJson(json['summary'] as Map<String, dynamic>? ?? {}),
      byCategory: List<Map<String, dynamic>>.from(distributions['byCategory'] ?? []),
      bySeverity: List<Map<String, dynamic>>.from(distributions['bySeverity'] ?? []),
      topActions: List<Map<String, dynamic>>.from(json['topActions'] ?? []),
      topIps: List<Map<String, dynamic>>.from(json['topIps'] ?? []),
    );
  }
}
