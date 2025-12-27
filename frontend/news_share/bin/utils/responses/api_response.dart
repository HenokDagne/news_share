import 'dart:convert';
import 'package:shelf/shelf.dart';

class ApiResponse {
  static Response success({
    dynamic data,
    String? message,
    int statusCode = 200,
  }) {
    final body = {
      'success': true,
      if (message != null) 'message': message,
      if (data != null) 'data': data,
    };
    return Response(
      statusCode,
      body: jsonEncode(body),
      headers: {'Content-Type': 'application/json'},
    );
  }

  static Response error({
    required String message,
    int statusCode = 400,
    dynamic errors,
  }) {
    final body = {
      'success': false,
      'message': message,
      if (errors != null) 'errors': errors,
    };
    return Response(
      statusCode,
      body: jsonEncode(body),
      headers: {'Content-Type': 'application/json'},
    );
  }

  static Response paginated({
    required List<dynamic> data,
    required int page,
    required int limit,
    required int total,
    String? message,
  }) {
    final body = {
      'success': true,
      if (message != null) 'message': message,
      'data': data,
      'pagination': {
        'page': page,
        'limit': limit,
        'total': total,
        'totalPages': (total / limit).ceil(),
      },
    };
    return Response(
      200,
      body: jsonEncode(body),
      headers: {'Content-Type': 'application/json'},
    );
  }
}

