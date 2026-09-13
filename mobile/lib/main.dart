import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'screens/camera_screen.dart';
import 'screens/history_screen.dart';
import 'screens/outbreak_screen.dart';
import 'screens/language_selection_screen.dart';
import 'screens/phone_auth_screen.dart';
import 'services/localization_service.dart';
import 'services/auth_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await LocaleController.instance.init();
  runApp(const KrishiRakshakApp());
}

class KrishiRakshakApp extends StatelessWidget {
  const KrishiRakshakApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: LocaleController.instance,
      builder: (context, child) {
        return MaterialApp(
          title: 'KrishiRakshak',
          debugShowCheckedModeBanner: false,
          theme: ThemeData(
            brightness: Brightness.dark,
            scaffoldBackgroundColor: const Color(0xFF0F1713),
            primaryColor: const Color(0xFF10B981),
            textTheme: GoogleFonts.interTextTheme(ThemeData.dark().textTheme),
            colorScheme: const ColorScheme.dark(
              primary: Color(0xFF10B981),
              secondary: Color(0xFF059669),
              surface: Color(0xFF16251E),
            ),
          ),
          home: const AppEntryRouter(),
        );
      },
    );
  }
}

/// Dynamic router determining initial screen based on persistence
class AppEntryRouter extends StatefulWidget {
  const AppEntryRouter({super.key});

  @override
  State<AppEntryRouter> createState() => _AppEntryRouterState();
}

class _AppEntryRouterState extends State<AppEntryRouter> {
  Widget? _initialScreen;

  @override
  void initState() {
    super.initState();
    _determineInitialScreen();
  }

  Future<void> _determineInitialScreen() async {
    final hasLang = await LocaleController.hasSelectedLanguage();
    if (!hasLang) {
      if (mounted) {
        setState(() {
          _initialScreen = const LanguageSelectionScreen(isFirstTime: true);
        });
      }
      return;
    }

    final isAuthed = await AuthService.isAuthenticated();
    if (!isAuthed) {
      if (mounted) {
        setState(() {
          _initialScreen = const PhoneAuthScreen();
        });
      }
      return;
    }

    if (mounted) {
      setState(() {
        _initialScreen = const MainNavigationScreen();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_initialScreen == null) {
      return const Scaffold(
        backgroundColor: Color(0xFF0F1713),
        body: Center(
          child: CircularProgressIndicator(color: Color(0xFF10B981)),
        ),
      );
    }
    return _initialScreen!;
  }
}

class MainNavigationScreen extends StatefulWidget {
  const MainNavigationScreen({super.key});

  @override
  State<MainNavigationScreen> createState() => _MainNavigationScreenState();
}

class _MainNavigationScreenState extends State<MainNavigationScreen> {
  int _currentIndex = 0;

  final List<Widget> _screens = const [
    CameraScreen(),
    HistoryScreen(),
    OutbreakScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    final locale = LocaleController.instance;

    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF16251E),
        elevation: 0,
        title: Row(
          children: [
            const Text('🌾', style: TextStyle(fontSize: 22)),
            const SizedBox(width: 8),
            Text(
              locale.text('app_title'),
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Color(0xFF10B981),
                letterSpacing: 1.1,
              ),
            ),
          ],
        ),
        actions: [
          // ── Fast Language Switcher in App Bar ──────────────────────────
          Padding(
            padding: const EdgeInsets.only(right: 12.0),
            child: ActionChip(
              avatar: Text(
                locale.currentLanguage.flag,
                style: const TextStyle(fontSize: 14),
              ),
              label: Text(
                locale.currentLanguage.nativeName,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
              backgroundColor: const Color(0xFF263F33),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
                side: const BorderSide(color: Color(0xFF10B981), width: 1),
              ),
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => const LanguageSelectionScreen(isFirstTime: false),
                  ),
                );
              },
            ),
          ),
        ],
      ),
      body: IndexedStack(
        index: _currentIndex,
        children: _screens,
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (index) => setState(() => _currentIndex = index),
        backgroundColor: const Color(0xFF16251E),
        selectedItemColor: const Color(0xFF10B981),
        unselectedItemColor: Colors.white54,
        type: BottomNavigationBarType.fixed,
        selectedFontSize: 13,
        unselectedFontSize: 12,
        selectedLabelStyle: const TextStyle(fontWeight: FontWeight.bold),
        items: [
          BottomNavigationBarItem(
            icon: const Icon(Icons.camera_alt_outlined),
            activeIcon: const Icon(Icons.camera_alt),
            label: locale.text('tab_diagnose'),
          ),
          BottomNavigationBarItem(
            icon: const Icon(Icons.history_outlined),
            activeIcon: const Icon(Icons.history),
            label: locale.text('tab_history'),
          ),
          BottomNavigationBarItem(
            icon: const Icon(Icons.warning_amber_outlined),
            activeIcon: const Icon(Icons.warning_amber_rounded),
            label: locale.text('tab_alerts'),
          ),
        ],
      ),
    );
  }
}
