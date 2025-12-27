import 'package:postgres/postgres.dart';
import 'package:dotenv/dotenv.dart';

late final Connection connection;
late final DotEnv dotEnv;

Future<void> initDb() async {
  try {
    // Load .env file from project root (only load once)
    dotEnv = DotEnv(includePlatformEnvironment: true)..load(['.env']);
    
    connection = await Connection.open(
      Endpoint(
        host: dotEnv['DB_HOST'] ?? 'localhost',
        port: int.parse(dotEnv['DB_PORT'] ?? '5432'),
        database: dotEnv['DB_NAME'] ?? 'news_share_db',
        username: dotEnv['DB_USER'] ?? 'postgres',
        password: dotEnv['DB_PASSWORD'] ?? '',
      ),
      settings: ConnectionSettings(sslMode: SslMode.disable),
    );
    print('✅ Database connection successful!');
  } catch (e) {
    print('❌ Database connection failed!');
    print('Error: $e');
    rethrow; // Re-throw to let caller handle the error
  }
}

// Example: fetch posts
Future<List<Map<String, dynamic>>> getPosts() async {
  final result = await connection.execute(
    'SELECT id, title, content, created_at FROM posts ORDER BY created_at DESC',
  );
  return result.map((row) => row.toColumnMap()).toList();
}
