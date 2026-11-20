import 'package:flutter/material.dart';
import '../../services/api_client.dart';

class ReportCategory {
  final String title;
  final List<ReportSubcategory> subcategories;

  const ReportCategory({required this.title, required this.subcategories});
}

class ReportSubcategory {
  final String label;
  final String code; // Mapped to backend enum code
  final String description;

  const ReportSubcategory({
    required this.label,
    required this.code,
    required this.description,
  });
}

class ReportSheet extends StatefulWidget {
  final String targetId;
  final String targetType; // 'POST' or 'USER'
  final String? targetTitle;

  const ReportSheet({
    super.key,
    required this.targetId,
    this.targetType = 'POST',
    this.targetTitle,
  });

  static Future<void> show(
    BuildContext context, {
    required String targetId,
    String targetType = 'POST',
    String? targetTitle,
  }) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ReportSheet(
        targetId: targetId,
        targetType: targetType,
        targetTitle: targetTitle,
      ),
    );
  }

  @override
  State<ReportSheet> createState() => _ReportSheetState();
}

class _ReportSheetState extends State<ReportSheet> {
  // Categories matching Screenshot 2
  static const List<ReportCategory> _categories = [
    ReportCategory(
      title: 'Violence, abuse, and criminal exploitation',
      subcategories: [
        ReportSubcategory(
          label: 'Threats of violence or incitement',
          code: 'VIOLENCE',
          description: 'Statements advocating violence or physical harm',
        ),
        ReportSubcategory(
          label: 'Physical abuse or assault',
          code: 'VIOLENCE',
          description: 'Depiction or promotion of physical harm',
        ),
        ReportSubcategory(
          label: 'Human exploitation or human trafficking',
          code: 'VIOLENCE',
          description: 'Exploitative or non-consensual activities',
        ),
      ],
    ),
    ReportCategory(
      title: 'Hate and harassment',
      subcategories: [
        ReportSubcategory(
          label: 'Harassment or cyberbullying',
          code: 'HARASSMENT_BULLYING',
          description: 'Targeted abuse, threats, or intimidation',
        ),
        ReportSubcategory(
          label: 'Hate speech or hateful symbols',
          code: 'HATE_SPEECH',
          description: 'Attacks on identity, ethnicity, race, religion, or orientation',
        ),
      ],
    ),
    ReportCategory(
      title: 'Suicide and self-harm',
      subcategories: [
        ReportSubcategory(
          label: 'Suicide or self-injury encouragement',
          code: 'VIOLENCE',
          description: 'Encouraging or instructing suicide or self-harm',
        ),
        ReportSubcategory(
          label: 'Self-harm depiction',
          code: 'OTHER',
          description: 'Imagery or discussion promoting self-harm',
        ),
      ],
    ),
    ReportCategory(
      title: 'Disordered eating and unhealthy body image',
      subcategories: [
        ReportSubcategory(
          label: 'Promoting severe disordered eating',
          code: 'OTHER',
          description: 'Encouraging anorexia, bulimia, or dangerous diets',
        ),
      ],
    ),
    ReportCategory(
      title: 'Dangerous activities and challenges',
      subcategories: [
        ReportSubcategory(
          label: 'Dangerous challenges or stunts',
          code: 'VIOLENCE',
          description: 'Activities posing imminent threat to life or health',
        ),
      ],
    ),
    ReportCategory(
      title: 'Nudity and sexual content',
      subcategories: [
        ReportSubcategory(
          label: 'Sexually explicit content',
          code: 'SEXUAL_CONTENT',
          description: 'Pornography, explicit sexual acts, or solicitation',
        ),
        ReportSubcategory(
          label: 'Nudity or semi-nudity',
          code: 'NUDITY',
          description: 'Non-consensual or inappropriate nudity',
        ),
      ],
    ),
    ReportCategory(
      title: 'Shocking and graphic content',
      subcategories: [
        ReportSubcategory(
          label: 'Gore, accidents, or grotesque imagery',
          code: 'VIOLENCE',
          description: 'Gratuitous violence, blood, or gory material',
        ),
      ],
    ),
    ReportCategory(
      title: 'Misinformation',
      subcategories: [
        ReportSubcategory(
          label: 'Election or public health falsehoods',
          code: 'MISINFORMATION',
          description: 'Dangerous or deceptive misinformation on critical issues',
        ),
        ReportSubcategory(
          label: 'Manipulated media / deepfakes',
          code: 'MISINFORMATION',
          description: 'Doctored videos, audio, or misleading news headlines',
        ),
      ],
    ),
    ReportCategory(
      title: 'Deceptive behavior and spam',
      subcategories: [
        ReportSubcategory(
          label: 'Commercial spam or unsolicited promotion',
          code: 'SPAM_SCAM',
          description: 'Automated posts, affiliate link spam, or bulk marketing',
        ),
        ReportSubcategory(
          label: 'Scams, fraud, or phishing',
          code: 'SPAM_SCAM',
          description: 'Financial fraud, crypto scams, or credential theft',
        ),
        ReportSubcategory(
          label: 'Impersonation',
          code: 'SPAM_SCAM',
          description: 'Pretending to be someone else or an official brand',
        ),
      ],
    ),
    ReportCategory(
      title: 'Regulated goods and activities',
      subcategories: [
        ReportSubcategory(
          label: 'Illegal sales, drugs, or firearms',
          code: 'OTHER',
          description: 'Selling or advertising restricted or illegal goods',
        ),
      ],
    ),
    ReportCategory(
      title: 'Other',
      subcategories: [
        ReportSubcategory(
          label: 'Intellectual property infringement',
          code: 'OTHER',
          description: 'Copyright or trademark violation',
        ),
        ReportSubcategory(
          label: 'Something else not listed',
          code: 'OTHER',
          description: 'Please describe the issue in the details box below',
        ),
      ],
    ),
  ];

  ReportCategory? _selectedCategory;
  ReportSubcategory? _selectedSubcategory;
  final TextEditingController _detailsController = TextEditingController();
  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void dispose() {
    _detailsController.dispose();
    super.dispose();
  }

  void _onCategoryTapped(ReportCategory category) {
    setState(() {
      _selectedCategory = category;
      _selectedSubcategory = category.subcategories.isNotEmpty
          ? category.subcategories.first
          : null;
      _errorMessage = null;
    });
  }

  void _onBackTapped() {
    setState(() {
      _selectedCategory = null;
      _selectedSubcategory = null;
      _errorMessage = null;
    });
  }

  Future<void> _submitReport() async {
    final sub = _selectedSubcategory;
    if (sub == null) return;

    final details = _detailsController.text.trim();
    if (sub.code == 'OTHER' && details.isEmpty) {
      setState(() {
        _errorMessage = 'Please provide details explaining why you are reporting this.';
      });
      return;
    }

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      final combinedDetails = details.isNotEmpty
          ? '[${_selectedCategory?.title} > ${sub.label}] $details'
          : '[${_selectedCategory?.title} > ${sub.label}]';

      if (widget.targetType == 'POST') {
        await ApiClient.instance.reportPost(
          widget.targetId,
          reason: sub.code,
          details: combinedDetails,
        );
      } else {
        await ApiClient.instance.reportUser(
          widget.targetId,
          reason: sub.code,
          details: combinedDetails,
        );
      }

      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: Color(0xFF10B981),
            behavior: SnackBarBehavior.floating,
            content: Text(
              'Thank you. We received your report and will review it confidentially.',
              style: TextStyle(fontWeight: FontWeight.w500, color: Colors.white),
            ),
          ),
        );
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
          _errorMessage = e.statusCode == 409
              ? 'You have already reported this ${widget.targetType.toLowerCase()}.'
              : e.message;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
          _errorMessage = 'Failed to submit report. Please try again.';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    final screenHeight = MediaQuery.of(context).size.height;

    return Container(
      constraints: BoxConstraints(
        maxHeight: screenHeight * 0.88,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.only(
        top: 12,
        bottom: bottomInset + 16,
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Top drag handle
            Center(
              child: Container(
                height: 4,
                width: 36,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 8),

            // Top Header: Centered "Select a reason", close button
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  if (_selectedCategory != null)
                    IconButton(
                      icon: const Icon(Icons.arrow_back, color: Colors.black87),
                      onPressed: _onBackTapped,
                    )
                  else
                    const SizedBox(width: 48),
                  Expanded(
                    child: Text(
                      _selectedCategory == null ? 'Select a reason' : 'Report reason',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.bold,
                        color: Colors.black,
                      ),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, color: Colors.black87),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),

            // Body
            Flexible(
              child: _selectedCategory == null
                  ? _buildCategoryList()
                  : _buildSubcategoryForm(),
            ),
          ],
        ),
      ),
    );
  }

  // SCREEN 1: List of Categories with right-chevron matching Screenshot 2
  Widget _buildCategoryList() {
    return ListView.builder(
      padding: const EdgeInsets.symmetric(vertical: 4),
      itemCount: _categories.length,
      itemBuilder: (context, index) {
        final cat = _categories[index];
        return InkWell(
          onTap: () => _onCategoryTapped(cat),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 15),
            decoration: BoxDecoration(
              border: Border(
                bottom: BorderSide(color: Colors.grey.shade100, width: 1),
              ),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    cat.title,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w400,
                      color: Colors.black87,
                    ),
                  ),
                ),
                Icon(
                  Icons.chevron_right,
                  color: Colors.grey.shade400,
                  size: 22,
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  // SCREEN 2: Subcategories and submission form
  Widget _buildSubcategoryForm() {
    final cat = _selectedCategory!;

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            cat.title,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: Colors.black,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Select the specific reason that best describes this issue:',
            style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
          ),
          const SizedBox(height: 14),

          if (_errorMessage != null)
            Container(
              margin: const EdgeInsets.only(bottom: 14),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.red.shade50,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.red.shade200),
              ),
              child: Row(
                children: [
                  Icon(Icons.error_outline, color: Colors.red.shade700, size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _errorMessage!,
                      style: TextStyle(color: Colors.red.shade800, fontSize: 13),
                    ),
                  ),
                ],
              ),
            ),

          // Subcategories list
          ...cat.subcategories.map((sub) {
            final isSelected = _selectedSubcategory == sub;
            return InkWell(
              onTap: () {
                setState(() {
                  _selectedSubcategory = sub;
                  _errorMessage = null;
                });
              },
              borderRadius: BorderRadius.circular(10),
              child: Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  color: isSelected ? const Color(0xFFFEF2F4) : Colors.grey.shade50,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: isSelected ? const Color(0xFFFE2C55) : Colors.grey.shade200,
                    width: isSelected ? 1.5 : 1,
                  ),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      isSelected ? Icons.radio_button_checked : Icons.radio_button_off,
                      color: isSelected ? const Color(0xFFFE2C55) : Colors.grey.shade400,
                      size: 20,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            sub.label,
                            style: TextStyle(
                              fontSize: 14.5,
                              fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                              color: Colors.black87,
                            ),
                          ),
                          if (sub.description.isNotEmpty) ...[
                            const SizedBox(height: 2),
                            Text(
                              sub.description,
                              style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            );
          }),

          const SizedBox(height: 12),
          Text(
            'Additional details (optional)',
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: Colors.grey.shade800),
          ),
          const SizedBox(height: 6),
          TextField(
            controller: _detailsController,
            maxLines: 3,
            maxLength: 500,
            decoration: InputDecoration(
              hintText: 'Help our moderation team understand the context...',
              hintStyle: TextStyle(fontSize: 13, color: Colors.grey.shade400),
              filled: true,
              fillColor: Colors.grey.shade50,
              contentPadding: const EdgeInsets.all(12),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: BorderSide(color: Colors.grey.shade300),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: BorderSide(color: Colors.grey.shade300),
              ),
              focusedBorder: const OutlineInputBorder(
                borderRadius: BorderRadius.all(Radius.circular(10)),
                borderSide: BorderSide(color: Color(0xFFFE2C55), width: 1.5),
              ),
            ),
          ),
          const SizedBox(height: 16),

          // TikTok-style red submit button
          SizedBox(
            height: 48,
            child: ElevatedButton(
              onPressed: _isSubmitting ? null : _submitReport,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFFE2C55),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                elevation: 0,
              ),
              child: _isSubmitting
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                    )
                  : const Text(
                      'Submit report',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}
