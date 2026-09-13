/// Represents a single prediction candidate (used for top-3 display).
class PredictionCandidate {
  final String crop;
  final String disease;
  final double confidence;

  PredictionCandidate({
    required this.crop,
    required this.disease,
    required this.confidence,
  });

  factory PredictionCandidate.fromJson(Map<String, dynamic> json) {
    return PredictionCandidate(
      crop: json['crop'] ?? 'Unknown',
      disease: json['disease'] ?? 'Unknown',
      confidence: (json['confidence'] as num?)?.toDouble() ?? 0.0,
    );
  }
}

/// Represents the primary scan/diagnosis result.
class ScanResult {
  final String? id;
  final String crop;
  final String disease;
  final double confidence;
  final String treatment;
  final double? latitude;
  final double? longitude;
  final String? geohash;
  final DateTime createdAt;
  final List<PredictionCandidate> top3;

  ScanResult({
    this.id,
    required this.crop,
    required this.disease,
    required this.confidence,
    required this.treatment,
    this.latitude,
    this.longitude,
    this.geohash,
    DateTime? createdAt,
    List<PredictionCandidate>? top3,
  })  : createdAt = createdAt ?? DateTime.now(),
        top3 = top3 ?? [];

  factory ScanResult.fromPredictionJson(
    Map<String, dynamic> json, {
    List<dynamic>? top3Raw,
  }) {
    return ScanResult(
      crop: json['crop'] ?? 'Unknown',
      disease: json['disease'] ?? 'Unknown',
      confidence: (json['confidence'] as num?)?.toDouble() ?? 0.0,
      treatment: json['treatment'] ?? 'No treatment info available.',
      top3: top3Raw != null
          ? top3Raw
              .map((e) => PredictionCandidate.fromJson(e as Map<String, dynamic>))
              .toList()
          : [],
    );
  }

  factory ScanResult.fromBackendJson(Map<String, dynamic> json) {
    return ScanResult(
      id: json['id'],
      crop: json['crop'] ?? 'Unknown',
      disease: json['disease'] ?? 'Unknown',
      confidence: (json['confidence'] as num?)?.toDouble() ?? 0.0,
      treatment: json['treatment'] ?? '',
      latitude: (json['latitude'] as num?)?.toDouble(),
      longitude: (json['longitude'] as num?)?.toDouble(),
      geohash: json['geohash'],
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at']) ?? DateTime.now()
          : DateTime.now(),
    );
  }

  bool get isHealthy => disease.toLowerCase().contains('healthy');
}
