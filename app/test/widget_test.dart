import 'package:flutter_test/flutter_test.dart';
import 'package:app/main.dart';

void main() {
  testWidgets('App renders OnboardingScreen when not enrolled', (WidgetTester tester) async {
    await tester.pumpWidget(const PhoneFinderApp(isEnrolled: false));
    await tester.pumpAndSettle();

    expect(find.text('Phone Finder'), findsOneWidget);
    expect(find.text('Begin Setup'), findsOneWidget);
  });
}
