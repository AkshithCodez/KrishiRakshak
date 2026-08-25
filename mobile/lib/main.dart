import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'screens/camera_screen.dart';
import 'screens/history_screen.dart';
import 'screens/outbreak_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const KrishiRakshakApp());
}

class KrishiRakshakApp extends StatelessWidget {
  const KrishiRakshakApp({super.key});

  @override
  Widget build(BuildContext context) {
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
      home: const MainNavigationScreen(),
    );
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
    return Scaffold(
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
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.camera_alt_outlined),
            activeIcon: Icon(Icons.camera_alt),
            label: 'Scan',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.history_outlined),
            activeIcon: Icon(Icons.history),
            label: 'History',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.warning_amber_outlined),
            activeIcon: Icon(Icons.warning_amber_rounded),
            label: 'Outbreaks',
          ),
        ],
      ),
    );
  }
}
