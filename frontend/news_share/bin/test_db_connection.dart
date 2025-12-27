import 'dart:io';
import 'database/db_connector.dart';

/// Test script to verify PostgreSQL database connection
/// 
/// Usage: dart run bin/test_db_connection.dart
/// 
/// Make sure:
/// 1. PostgreSQL is running
/// 2. Database 'news_share_db' exists
/// 3. Credentials are correct in db_connector.dart
Future<void> main() async {
  print('🔍 Testing PostgreSQL database connection...\n');

  try {
    // Test 1: Connect to database
    print('📡 Step 1: Attempting to connect to database...');
    await initDb();
    print('✅ Connection successful!\n');

    // Test 2: Check if database is accessible with a simple query
    print('📡 Step 2: Testing database query...');
    final result = await connection.execute('SELECT version()');
    final version = result.first[0] as String;
    print('✅ Database version: $version\n');

    // Test 3: Check if UUID extension exists
    print('📡 Step 3: Checking UUID extension...');
    final uuidCheck = await connection.execute(
      "SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp')"
    );
    final hasUuidExt = uuidCheck.first[0] as bool;
    if (hasUuidExt) {
      print('✅ UUID extension is installed\n');
    } else {
      print('⚠️  UUID extension not found. Run: CREATE EXTENSION IF NOT EXISTS "uuid-ossp";\n');
    }

    // Test 4: List all tables
    print('📡 Step 4: Checking existing tables...');
    final tablesResult = await connection.execute(
      "SELECT table_name FROM information_schema.tables "
      "WHERE table_schema = 'public' ORDER BY table_name"
    );
    
    if (tablesResult.isEmpty) {
      print('⚠️  No tables found. You may need to run the SQL schema creation script.\n');
    } else {
      print('✅ Found ${tablesResult.length} table(s):');
      for (final row in tablesResult) {
        print('   - ${row[0]}');
      }
      print('');
    }

    // Test 5: Test a simple query on users table (if it exists)
    print('📡 Step 5: Testing query on users table...');
    try {
      final userCount = await connection.execute('SELECT COUNT(*) FROM users');
      print('✅ Users table accessible. Current user count: ${userCount.first[0]}\n');
    } catch (e) {
      print('⚠️  Users table not found or not accessible: $e\n');
    }

    // Close connection
    print('📡 Step 6: Closing connection...');
    await connection.close();
    print('✅ Connection closed successfully!\n');

    print('🎉 All tests passed! Database connection is working correctly.\n');
    exit(0);

  } on SocketException catch (e) {
    print('❌ Connection failed: Cannot reach PostgreSQL server');
    print('   Error: $e\n');
    print('💡 Troubleshooting:');
    print('   1. Make sure PostgreSQL is running');
    print('   2. Check host and port in db_connector.dart (default: localhost:5432)');
    print('   3. Verify PostgreSQL is listening on the correct port\n');
    exit(1);

  } on FormatException catch (e) {
    print('❌ Configuration error: Invalid database configuration');
    print('   Error: $e\n');
    print('💡 Troubleshooting:');
    print('   1. Check database credentials in db_connector.dart');
    print('   2. Verify database name is correct\n');
    exit(1);

  } catch (e) {
    print('❌ Database connection failed!');
    print('   Error: $e\n');
    print('💡 Troubleshooting:');
    print('   1. Verify PostgreSQL is running');
    print('   2. Check database credentials in db_connector.dart');
    print('   3. Ensure database "news_share_db" exists');
    print('   4. Verify user has proper permissions\n');
    exit(1);
  }
}

