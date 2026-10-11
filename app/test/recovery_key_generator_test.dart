import 'package:flutter_test/flutter_test.dart';
import 'package:app/utils/recovery_key_generator.dart';

void main() {
  test('RecoveryKeyGenerator creates valid Crockford Base32 key with PF- prefix', () {
    final key = RecoveryKeyGenerator.generate();

    // Check format: PF-XXXX-XXXX-XXXX (17 chars total)
    expect(key.startsWith('PF-'), isTrue);
    expect(key.length, equals(17));

    final regex = RegExp(r'^PF-[23456789ABCDEFGHJKMNPQRSTVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTVWXYZ]{4}$');
    expect(regex.hasMatch(key), isTrue);

    // Verify randomness across multiple calls
    final key2 = RecoveryKeyGenerator.generate();
    expect(key, isNot(equals(key2)));
  });
}
