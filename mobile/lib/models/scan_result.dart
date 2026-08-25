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
  }) : createdAt = createdAt ?? DateTime.now();

  factory ScanResult.fromPredictionJson(Map<String, dynamic> json) {
    return ScanResult(
      crop: json['crop'] ?? 'Unknown',
      disease: json['disease'] ?? 'Unknown',
      confidence: (json['confidence'] as num?)?.toDouble() ?? 0.0,
      treatment: json['treatment'] ?? 'No treatment info available.',
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
