import 'dart:math';

class RecoveryKeyGenerator {
  static const _alphabet = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

  /// Generates a 12-character Crockford Base32 recovery key formatted as PF-XXXX-XXXX-XXXX.
  static String generate() {
    final random = Random.secure();
    String generateSegment(int length) {
      final buffer = StringBuffer();
      for (int i = 0; i < length; i++) {
        buffer.write(_alphabet[random.nextInt(_alphabet.length)]);
      }
      return buffer.toString();
    }

    final p1 = generateSegment(4);
    final p2 = generateSegment(4);
    final p3 = generateSegment(4);

    return 'PF-$p1-$p2-$p3';
  }
}
