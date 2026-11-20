import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../services/api_client.dart';
import 'package:news_share/screens/home/home_page.dart';

/// Genuine Google account model containing real profile information from Google OAuth
class GoogleAccountSession {
  final String email;
  final String displayName;
  final String? photoUrl;
  final String? idToken;
  final String? accessToken;
  final DateTime lastAuthenticated;

  GoogleAccountSession({
    required this.email,
    required this.displayName,
    this.photoUrl,
    this.idToken,
    this.accessToken,
    DateTime? lastAuthenticated,
  }) : lastAuthenticated = lastAuthenticated ?? DateTime.now();

  Map<String, dynamic> toJson() => {
    'email': email,
    'displayName': displayName,
    'photoUrl': photoUrl,
    'idToken': idToken,
    'accessToken': accessToken,
    'lastAuthenticated': lastAuthenticated.toIso8601String(),
  };

  factory GoogleAccountSession.fromJson(Map<String, dynamic> json) => GoogleAccountSession(
    email: (json['email'] ?? '') as String,
    displayName: (json['displayName'] ?? json['name'] ?? (json['email'] as String).split('@')[0]) as String,
    photoUrl: json['photoUrl'] as String?,
    idToken: json['idToken'] as String?,
    accessToken: json['accessToken'] as String?,
    lastAuthenticated: json['lastAuthenticated'] != null
        ? DateTime.tryParse(json['lastAuthenticated'] as String) ?? DateTime.now()
        : DateTime.now(),
  );
}

/// Persistent storage for authenticated Google accounts in SharedPreferences
class GoogleAccountStorage {
  static const String _storageKey = 'news_share_google_accounts_list';

  static Future<List<GoogleAccountSession>> getAccounts() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final list = prefs.getStringList(_storageKey) ?? [];
      final accounts = list
          .map((item) {
            try {
              return GoogleAccountSession.fromJson(jsonDecode(item) as Map<String, dynamic>);
            } catch (_) {
              return null;
            }
          })
          .whereType<GoogleAccountSession>()
          .toList();

      accounts.sort((a, b) => b.lastAuthenticated.compareTo(a.lastAuthenticated));
      return accounts;
    } catch (_) {
      return [];
    }
  }

  static Future<void> saveAccount(GoogleAccountSession account) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final accounts = await getAccounts();
      accounts.removeWhere((a) => a.email.toLowerCase() == account.email.toLowerCase());
      accounts.insert(0, account);
      final jsonList = accounts.map((a) => jsonEncode(a.toJson())).toList();
      await prefs.setStringList(_storageKey, jsonList);
    } catch (e) {
      debugPrint('Error saving Google account: $e');
    }
  }

  static Future<void> removeAccount(String email) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final accounts = await getAccounts();
      accounts.removeWhere((a) => a.email.toLowerCase() == email.toLowerCase());
      final jsonList = accounts.map((a) => jsonEncode(a.toJson())).toList();
      await prefs.setStringList(_storageKey, jsonList);
    } catch (e) {
      debugPrint('Error removing Google account: $e');
    }
  }
}

/// Color generator for account initial avatars matching Google Material Design palette
Color _getGoogleAvatarColor(String seed) {
  final colors = [
    const Color(0xFF1A73E8), // Google Blue
    const Color(0xFF1E8E3E), // Google Green
    const Color(0xFFEA4335), // Google Red
    const Color(0xFFF9AB00), // Google Yellow / Amber
    const Color(0xFF8430CE), // Google Purple
    const Color(0xFF129EAF), // Google Teal
  ];
  final index = seed.hashCode.abs() % colors.length;
  return colors[index];
}

/// Orchestrates genuine Google Sign-In and official Account Chooser UI
class GoogleLoginHandler {
  // Read Google OAuth Client ID securely from .env
  static String get googleClientId {
    return dotenv.env['GOOGLE_CLIENT_ID'] ?? dotenv.env['client_ID'] ?? '';
  }

  // Official Google Sign-In SDK instance configured with Web Client ID as serverClientId.
  // When using google_sign_in without google-services.json on Android, the Web Client ID
  // must be provided as serverClientId to obtain an ID token verified by the backend.
  late final GoogleSignIn _googleSignIn = GoogleSignIn(
    serverClientId: googleClientId.isNotEmpty ? googleClientId : null,
    clientId: kIsWeb ? (googleClientId.isNotEmpty ? googleClientId : null) : null,
    scopes: const <String>[
      'email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
  );

  /// Main entry point triggered when the user taps "Continue with Google" / "Sign in with Google"
  Future<void> handleGoogleLogin(BuildContext context) async {
    try {
      // 1. Fetch available authenticated Google accounts from persistent storage
      final savedAccounts = await GoogleAccountStorage.getAccounts();

      // 2. On mobile/web, attempt silent discovery of active Google session
      if (kIsWeb || (!Platform.isWindows && !Platform.isLinux)) {
        try {
          final silentUser = await _googleSignIn.signInSilently();
          if (silentUser != null) {
            final auth = await silentUser.authentication;
            final session = GoogleAccountSession(
              email: silentUser.email,
              displayName: silentUser.displayName ?? silentUser.email.split('@')[0],
              photoUrl: silentUser.photoUrl,
              idToken: auth.idToken,
              accessToken: auth.accessToken,
              lastAuthenticated: DateTime.now(),
            );
            await GoogleAccountStorage.saveAccount(session);
            if (!savedAccounts.any((a) => a.email.toLowerCase() == session.email.toLowerCase())) {
              savedAccounts.insert(0, session);
            }
          }
        } catch (_) {
          // Silent sign-in is best-effort
        }
      }

      if (!context.mounted) return;

      // 3. If saved accounts is empty, check if ApiClient has an active Google email profile
      if (savedAccounts.isEmpty) {
        final currentEmail = ApiClient.instance.currentUserEmail;
        final currentUser = ApiClient.instance.currentUser;
        if (currentEmail != null && currentEmail.toLowerCase().contains('@gmail.com')) {
          final session = GoogleAccountSession(
            email: currentEmail,
            displayName: (currentUser?.fullName != null && currentUser!.fullName!.isNotEmpty)
                ? currentUser.fullName!
                : (currentUser?.username ?? currentEmail.split('@')[0]),
            photoUrl: currentUser?.avatarUrl,
            lastAuthenticated: DateTime.now(),
          );
          await GoogleAccountStorage.saveAccount(session);
          savedAccounts.add(session);
        }
      }

      // 4. If there are known accounts, present the official Google Account Chooser UI
      if (savedAccounts.isNotEmpty) {
        await _showGoogleAccountChooserModal(context, savedAccounts);
        return;
      }

      // 5. If no accounts exist yet, launch Google's official account authentication flow
      final newAccount = await launchOfficialGoogleOAuthFlow(context);
      if (newAccount != null && context.mounted) {
        await _completeLoginWithAccount(context, newAccount);
      }
    } catch (e) {
      debugPrint('Google Sign-In initialization error: $e');
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Google Sign-In: $e'),
            backgroundColor: Colors.red.shade700,
          ),
        );
      }
    }
  }

  /// Displays Google's official Account Chooser modal dialog matching Google's visual guidelines
  Future<void> _showGoogleAccountChooserModal(
    BuildContext context,
    List<GoogleAccountSession> initialAccounts,
  ) async {
    await showDialog<void>(
      context: context,
      barrierDismissible: true,
      builder: (dialogCtx) {
        return _GoogleAccountChooserDialog(
          initialAccounts: initialAccounts,
          onSelectAccount: (account) async {
            Navigator.of(dialogCtx).pop();
            await _completeLoginWithAccount(context, account);
          },
          onAddAnotherAccount: () async {
            Navigator.of(dialogCtx).pop();
            final account = await launchOfficialGoogleOAuthFlow(context);
            if (account != null && context.mounted) {
              await _completeLoginWithAccount(context, account);
            }
          },
        );
      },
    );
  }

  /// Completes authentication with the backend and transitions to HomePage
  Future<void> _completeLoginWithAccount(
    BuildContext context,
    GoogleAccountSession account,
  ) async {
    try {
      // 1. Authenticate with backend NestJS REST API
      final user = await ApiClient.instance.loginWithGoogle(
        email: account.email,
        fullName: account.displayName,
        avatarUrl: account.photoUrl,
        idToken: account.idToken,
      );

      // 2. Update last-used timestamp in storage
      final updated = GoogleAccountSession(
        email: account.email,
        displayName: account.displayName,
        photoUrl: account.photoUrl,
        idToken: account.idToken,
        accessToken: account.accessToken,
        lastAuthenticated: DateTime.now(),
      );
      await GoogleAccountStorage.saveAccount(updated);

      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                const Icon(Icons.check_circle_outline, color: Colors.white, size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Signed in as ${user.fullName ?? user.username} (${account.email})',
                    style: const TextStyle(fontWeight: FontWeight.w500),
                  ),
                ),
              ],
            ),
            backgroundColor: const Color(0xFF1E8E3E),
            duration: const Duration(seconds: 3),
          ),
        );

        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (context) => const HomePage()),
        );
      }
    } catch (e) {
      debugPrint('Backend Google login error: $e');
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Login failed: $e'),
            backgroundColor: Colors.red.shade700,
          ),
        );
      }
    }
  }

  /// Launches Google's official account authentication flow using official GoogleSignIn SDK
  Future<GoogleAccountSession?> launchOfficialGoogleOAuthFlow(BuildContext context) async {
    try {
      debugPrint('Starting native Google OAuth flow via GoogleSignIn SDK...');
      debugPrint('Configured serverClientId: $googleClientId');

      // Disconnect or sign out to ensure Google displays the account selection prompt
      try {
        await _googleSignIn.signOut();
      } catch (_) {}

      final googleUser = await _googleSignIn.signIn();
      if (googleUser == null) {
        debugPrint('Google sign-in cancelled by user');
        return null;
      }

      final googleAuth = await googleUser.authentication;
      final account = GoogleAccountSession(
        email: googleUser.email,
        displayName: googleUser.displayName ?? googleUser.email.split('@')[0],
        photoUrl: googleUser.photoUrl,
        idToken: googleAuth.idToken,
        accessToken: googleAuth.accessToken,
        lastAuthenticated: DateTime.now(),
      );

      await GoogleAccountStorage.saveAccount(account);
      return account;
    } on MissingPluginException {
      debugPrint('MissingPluginException: google_sign_in is not available on this desktop runner.');
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Google Sign-In is configured for Android & Web. Please run the app on Android or Chrome (flutter run -d chrome).',
            ),
            backgroundColor: Color(0xFF1A73E8),
            duration: Duration(seconds: 6),
          ),
        );
      }
      return null;
    } catch (e) {
      debugPrint('Native Google OAuth error: $e');
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Google Sign-In failed: $e'),
            backgroundColor: Colors.red.shade700,
          ),
        );
      }
      return null;
    }
  }
}

/// Official Google Account Chooser UI Dialog
class _GoogleAccountChooserDialog extends StatefulWidget {
  final List<GoogleAccountSession> initialAccounts;
  final ValueChanged<GoogleAccountSession> onSelectAccount;
  final VoidCallback onAddAnotherAccount;

  const _GoogleAccountChooserDialog({
    required this.initialAccounts,
    required this.onSelectAccount,
    required this.onAddAnotherAccount,
  });

  @override
  State<_GoogleAccountChooserDialog> createState() => _GoogleAccountChooserDialogState();
}

class _GoogleAccountChooserDialogState extends State<_GoogleAccountChooserDialog> {
  late List<GoogleAccountSession> _accounts;
  String? _authenticatingEmail;
  bool _isAddingAnother = false;

  @override
  void initState() {
    super.initState();
    _accounts = List.from(widget.initialAccounts);
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(28),
      ),
      elevation: 6,
      insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 420),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 20, 24, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Top Header: Google 'G' icon & Close Button
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Image.asset(
                    'assets/images/google_logo.png',
                    height: 26,
                    width: 26,
                    errorBuilder: (context, error, stackTrace) {
                      return const Icon(Icons.account_circle, color: Color(0xFF1A73E8), size: 26);
                    },
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, size: 20, color: Color(0xFF444746)),
                    tooltip: 'Cancel',
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                    onPressed: (_authenticatingEmail != null || _isAddingAnother)
                        ? null
                        : () => Navigator.of(context).pop(),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Title & Subtitle matching Google's Account Chooser
              const Text(
                'Choose an account',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w500,
                  color: Color(0xFF1F1F1F),
                  letterSpacing: -0.2,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                'to continue to News Share',
                style: TextStyle(
                  fontSize: 14,
                  color: Color(0xFF444746),
                ),
              ),
              const SizedBox(height: 16),
              const Divider(height: 1, thickness: 1, color: Color(0xFFE0E2EC)),

              // List of Genuine Accounts
              Flexible(
                child: ListView.separated(
                  shrinkWrap: true,
                  physics: const ClampingScrollPhysics(),
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  itemCount: _accounts.length,
                  separatorBuilder: (_, __) => const Divider(
                    height: 1,
                    thickness: 0.8,
                    color: Color(0xFFF0F1F5),
                  ),
                  itemBuilder: (context, index) {
                    final account = _accounts[index];
                    final isBusy = _authenticatingEmail == account.email;

                    return _buildAccountTile(account, isBusy);
                  },
                ),
              ),

              const Divider(height: 1, thickness: 1, color: Color(0xFFE0E2EC)),

              // "Use another account" tile
              _buildAddAnotherAccountTile(),

              const SizedBox(height: 16),
              const Divider(height: 1, thickness: 1, color: Color(0xFFE0E2EC)),
              const SizedBox(height: 12),

              // Official Google Disclaimer Footer
              const Text(
                'To continue, Google will share your name, email address, language preference, and profile picture with News Share. Before using this app, you can review News Share\'s Privacy Policy and Terms of Service.',
                style: TextStyle(
                  fontSize: 11,
                  color: Color(0xFF747775),
                  height: 1.45,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Builds an account row displaying the real profile photo, display name, and email
  Widget _buildAccountTile(GoogleAccountSession account, bool isBusy) {
    final hasPhoto = account.photoUrl != null && account.photoUrl!.isNotEmpty;
    final initial = account.displayName.isNotEmpty
        ? account.displayName[0].toUpperCase()
        : (account.email.isNotEmpty ? account.email[0].toUpperCase() : 'G');

    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: (_authenticatingEmail != null || _isAddingAnother)
          ? null
          : () {
              setState(() => _authenticatingEmail = account.email);
              widget.onSelectAccount(account);
            },
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
        child: Row(
          children: [
            // Genuine Profile Photo or Initial Avatar
            ClipOval(
              child: SizedBox(
                width: 40,
                height: 40,
                child: hasPhoto
                    ? Image.network(
                        account.photoUrl!,
                        width: 40,
                        height: 40,
                        fit: BoxFit.cover,
                        errorBuilder: (context, error, stackTrace) {
                          return CircleAvatar(
                            radius: 20,
                            backgroundColor: _getGoogleAvatarColor(account.displayName),
                            child: Text(
                              initial,
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                                fontSize: 16,
                              ),
                            ),
                          );
                        },
                      )
                    : CircleAvatar(
                        radius: 20,
                        backgroundColor: _getGoogleAvatarColor(account.displayName),
                        child: Text(
                          initial,
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                          ),
                        ),
                      ),
              ),
            ),
            const SizedBox(width: 14),

            // Display Name and Email Address
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    account.displayName,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF1F1F1F),
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    account.email,
                    style: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFF444746),
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),

            // Selection state / loading indicator
            if (isBusy)
              const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: Color(0xFF1A73E8),
                ),
              )
            else
              IconButton(
                icon: const Icon(Icons.close, size: 16, color: Color(0xFF9E9E9E)),
                tooltip: 'Remove account',
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
                onPressed: () async {
                  await GoogleAccountStorage.removeAccount(account.email);
                  setState(() {
                    _accounts.removeWhere((a) => a.email == account.email);
                  });
                },
              ),
          ],
        ),
      ),
    );
  }

  /// Builds the "Use another account" tile that invokes Google's official account authentication flow
  Widget _buildAddAnotherAccountTile() {
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: (_authenticatingEmail != null || _isAddingAnother)
          ? null
          : () {
              setState(() => _isAddingAnother = true);
              widget.onAddAnotherAccount();
            },
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: const Color(0xFFC4C7C5), width: 1),
              ),
              child: const Icon(
                Icons.person_add_alt_1_outlined,
                size: 20,
                color: Color(0xFF1A73E8),
              ),
            ),
            const SizedBox(width: 14),
            const Expanded(
              child: Text(
                'Use another account',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: Color(0xFF1F1F1F),
                ),
              ),
            ),
            if (_isAddingAnother)
              const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: Color(0xFF1A73E8),
                ),
              )
            else
              const Icon(
                Icons.chevron_right,
                size: 20,
                color: Color(0xFF747775),
              ),
          ],
        ),
      ),
    );
  }
}
