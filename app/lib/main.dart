import 'package:flutter/material.dart';
import 'screens/dashboard_screen.dart';
import 'screens/onboarding_screen.dart';
import 'services/storage_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final storageService = StorageService();
  final isEnrolled = await storageService.isEnrolled();

  runApp(PhoneFinderApp(isEnrolled: isEnrolled));
}

class PhoneFinderApp extends StatelessWidget {
  final bool isEnrolled;

  const PhoneFinderApp({super.key, required this.isEnrolled});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Phone Finder',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.blue),
        useMaterial3: true,
        scaffoldBackgroundColor: Colors.white,
      ),
      home: isEnrolled ? const DashboardScreen() : const OnboardingScreen(),
    );
  }
}
