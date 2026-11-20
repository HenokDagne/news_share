import 'package:flutter/material.dart';
import '../../services/api_client.dart';

class ActivityPage extends StatefulWidget {
  const ActivityPage({super.key});

  @override
  State<ActivityPage> createState() => _ActivityPageState();
}

class _ActivityPageState extends State<ActivityPage> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  List<Map<String, dynamic>> _activities = [];
  List<Map<String, dynamic>> _reports = [];
  List<Map<String, dynamic>> _warnings = [];

  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _loadAllData();
  }

  Future<void> _loadAllData() async {
    setState(() => _isLoading = true);
    try {
      final actFuture = ApiClient.instance.getUserActivity();
      final repFuture = ApiClient.instance.getMyReports();
      final warFuture = ApiClient.instance.getMyWarnings();

      final results = await Future.wait([actFuture, repFuture, warFuture]);
      if (mounted) {
        setState(() {
          _activities = results[0];
          _reports = results[1];
          _warnings = results[2];
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  String _mapReportStatus(String? status) {
    switch (status?.toUpperCase()) {
      case 'PENDING':
        return 'Received';
      case 'UNDER_REVIEW':
        return 'Under review';
      case 'ACTION_TAKEN':
        return 'Action taken';
      case 'REJECTED':
        return 'No violation found';
      case 'RESOLVED':
        return 'Resolved';
      default:
        return 'Received';
    }
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'Action taken':
        return const Color(0xFF10B981);
      case 'Under review':
        return const Color(0xFF00F2FE);
      case 'No violation found':
      case 'Resolved':
        return Colors.grey.shade600;
      default:
        return Colors.amber.shade700;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text(
          'Personal Activity & History',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17),
        ),
        bottom: TabBar(
          controller: _tabController,
          labelColor: Colors.black87,
          unselectedLabelColor: Colors.grey,
          indicatorColor: Colors.blue,
          tabs: [
            Tab(text: 'Activity (${_activities.length})'),
            Tab(text: 'My Reports (${_reports.length})'),
            Tab(text: 'Warnings (${_warnings.length})'),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.done_all),
            tooltip: 'Mark all read',
            onPressed: () async {
              await ApiClient.instance.markAllActivityRead();
              _loadAllData();
            },
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : TabBarView(
              controller: _tabController,
              children: [
                // Tab 1: Activity
                RefreshIndicator(
                  onRefresh: _loadAllData,
                  child: _activities.isEmpty
                      ? const Center(child: Text('No activity history recorded.'))
                      : ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: _activities.length,
                          separatorBuilder: (_, __) => const Divider(height: 1),
                          itemBuilder: (context, i) {
                            final act = _activities[i];
                            final title = act['title']?.toString() ?? 'Activity';
                            final body = act['body']?.toString();
                            final isRead = act['isRead'] == true;

                            return ListTile(
                              contentPadding: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
                              leading: CircleAvatar(
                                radius: 18,
                                backgroundColor: isRead ? Colors.grey.shade100 : Colors.blue.shade50,
                                child: Icon(
                                  Icons.notifications_outlined,
                                  size: 18,
                                  color: isRead ? Colors.grey : Colors.blue,
                                ),
                              ),
                              title: Text(
                                title,
                                style: TextStyle(
                                  fontWeight: isRead ? FontWeight.normal : FontWeight.bold,
                                  fontSize: 14,
                                ),
                              ),
                              subtitle: body != null ? Text(body, style: const TextStyle(fontSize: 12)) : null,
                              trailing: !isRead
                                  ? Container(
                                      height: 8,
                                      width: 8,
                                      decoration: const BoxDecoration(
                                        color: Colors.blue,
                                        shape: BoxShape.circle,
                                      ),
                                    )
                                  : null,
                            );
                          },
                        ),
                ),

                // Tab 2: My Reports
                RefreshIndicator(
                  onRefresh: _loadAllData,
                  child: _reports.isEmpty
                      ? const Center(child: Text('You have not filed any reports.'))
                      : ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: _reports.length,
                          separatorBuilder: (_, __) => const Divider(height: 1),
                          itemBuilder: (context, i) {
                            final r = _reports[i];
                            final reason = r['reason']?.toString() ?? 'General';
                            final rawStatus = r['status']?.toString();
                            final mapped = _mapReportStatus(rawStatus);
                            final color = _statusColor(mapped);

                            return ListTile(
                              contentPadding: const EdgeInsets.symmetric(vertical: 6, horizontal: 8),
                              leading: const CircleAvatar(
                                radius: 18,
                                backgroundColor: Color(0xFFFFF1F2),
                                child: Icon(Icons.flag, size: 18, color: Color(0xFFFE2C55)),
                              ),
                              title: Text(
                                'Reported: $reason',
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                              ),
                              subtitle: Text(
                                'Submitted: ${r["createdAt"] != null ? r["createdAt"].toString().split("T")[0] : ""}',
                                style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                              ),
                              trailing: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  color: color.withOpacity(0.12),
                                  borderRadius: BorderRadius.circular(20),
                                  border: Border.all(color: color.withOpacity(0.3)),
                                ),
                                child: Text(
                                  mapped,
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                    color: color,
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
                ),

                // Tab 3: Warnings
                RefreshIndicator(
                  onRefresh: _loadAllData,
                  child: _warnings.isEmpty
                      ? const Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.verified_user_outlined, size: 48, color: Colors.green),
                              SizedBox(height: 8),
                              Text('No warnings. Your account is in good standing.'),
                            ],
                          ),
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: _warnings.length,
                          separatorBuilder: (_, __) => const Divider(height: 1),
                          itemBuilder: (context, i) {
                            final w = _warnings[i];
                            final message = w['message']?.toString() ?? 'Official Notice';
                            final ref = w['policyRef']?.toString() ?? 'Community Standards';

                            return Container(
                              margin: const EdgeInsets.symmetric(vertical: 4),
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: const Color(0xFFFFFBEB),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: const Color(0xFFFDE68A)),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      const Icon(Icons.warning_amber_rounded, size: 18, color: Color(0xFFD97706)),
                                      const SizedBox(width: 8),
                                      const Text(
                                        'Official Warning',
                                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF92400E)),
                                      ),
                                      const Spacer(),
                                      Text(
                                        'Ref: $ref',
                                        style: TextStyle(fontSize: 11, color: Colors.amber.shade800),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    message,
                                    style: const TextStyle(fontSize: 13, color: Colors.black87),
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                ),
              ],
            ),
    );
  }
}
