import 'dart:convert';
import 'dart:io';

// Copies only Firebase's public client key; server secrets never enter this app.
void main() {
  var key = Platform.environment['FIREBASE_API_KEY'] ?? '';
  final env = File('../.env');
  if (key.isEmpty && env.existsSync()) {
    final match = RegExp(
      r'^NEXT_PUBLIC_FIREBASE_API_KEY\s*=\s*(.*)$',
      multiLine: true,
    ).firstMatch(env.readAsStringSync());
    key = (match?.group(1) ?? '').trim().replaceAll(
      RegExp(r'''^["']|["']$'''),
      '',
    );
  }
  if (key.isEmpty) {
    stderr.writeln(
      'Set FIREBASE_API_KEY to the Firebase public web API key and run again.',
    );
    exitCode = 1;
    return;
  }
  Directory('config').createSync(recursive: true);
  File('config/local.json').writeAsStringSync(
    const JsonEncoder.withIndent('  ').convert({
      'FIREBASE_API_KEY': key,
      'API_BASE_URL':
          Platform.environment['API_BASE_URL'] ?? 'https://raunak.yaduraj.me',
    }),
  );
  stdout.writeln(
    'Created ignored config/local.json with public client configuration only.',
  );
}
