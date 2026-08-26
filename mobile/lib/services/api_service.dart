import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';
import '../models/scan_result.dart';
import '../models/outbreak_alert.dart';

class ApiService {
  static const String defaultMlUrl = 'http://192.168.0.134:8001';
  static const String defaultBackendUrl = 'http://192.168.0.134:8000';

  static String mlBaseUrl = defaultMlUrl;
  static String backendBaseUrl = defaultBackendUrl;

  static String? _cachedDeviceId;

  /// Retrieve or generate persistent device UUID
  static Future<String> getDeviceId() async {
    if (_cachedDeviceId != null) return _cachedDeviceId!;
    final prefs = await SharedPreferences.getInstance();
    String? id = prefs.getString('krishi_device_id');
    if (id == null) {
      id = 'farmer_${const Uuid().v4().substring(0, 8)}';
      await prefs.setString('krishi_device_id', id);
    }
    _cachedDeviceId = id;
    return id;
  }

  /// Upload photo to ML Service for instant diagnosis
  static Future<ScanResult> diagnoseLeaf(File imageFile) async {
    final uri = Uri.parse('$mlBaseUrl/predict');
    final request = http.MultipartRequest('POST', uri);

    final fileStream = http.ByteStream(imageFile.openRead());
    final length = await imageFile.length();

    final multipartFile = http.MultipartFile(
      'file',
      fileStream,
      length,
      filename: 'leaf.jpg',
      contentType: MediaType('image', 'jpeg'),
    );
    request.files.add(multipartFile);

    final streamedResponse = await request.send().timeout(const Duration(seconds: 15));
    final response = await http.Response.fromStream(streamedResponse);

    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      return ScanResult.fromPredictionJson(data['prediction']);
    } else {
      throw Exception('ML Diagnosis failed: ${response.statusCode} - ${response.body}');
    }
  }

  /// Submit diagnosis and geolocation to backend for community outbreak tracking
  static Future<void> logScanToBackend({
    required ScanResult result,
    required double latitude,
    required double longitude,
  }) async {
    final deviceId = await getDeviceId();
    final uri = Uri.parse('$backendBaseUrl/api/scans');

    final payload = {
      'device_id': deviceId,
      'crop': result.crop,
      'disease': result.disease,
      'confidence': result.confidence,
      'latitude': latitude,
      'longitude': longitude,
      'treatment': result.treatment,
    };

    final response = await http.post(
      uri,
      headers: {'Content-Type': 'application/json'},
      body: json.encode(payload),
    ).timeout(const Duration(seconds: 10));

    if (response.statusCode != 201) {
      // Non-blocking error
      print('Warning: Failed to log scan to backend: ${response.body}');
    }
  }

  /// Fetch scan history for this device
  static Future<List<ScanResult>> fetchDeviceHistory() async {
    final deviceId = await getDeviceId();
    final uri = Uri.parse('$backendBaseUrl/api/scans?device_id=$deviceId&limit=50');

    final response = await http.get(uri).timeout(const Duration(seconds: 10));
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      final List scansList = data['scans'] ?? [];
      return scansList.map((s) => ScanResult.fromBackendJson(s)).toList();
    }
    return [];
  }

  /// Fetch active regional outbreaks
  static Future<List<OutbreakAlert>> fetchOutbreaks() async {
    final uri = Uri.parse('$backendBaseUrl/api/outbreaks');
    final response = await http.get(uri).timeout(const Duration(seconds: 10));

    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      final List alerts = data['alerts'] ?? [];
      return alerts.map((a) => OutbreakAlert.fromJson(a)).toList();
    }
    return [];
  }
}
