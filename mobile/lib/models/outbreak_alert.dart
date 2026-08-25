class OutbreakAlert {
  final String id;
  final String disease;
  final String crop;
  final String geohash;
  final int caseCount;
  final double centerLat;
  final double centerLng;
  final DateTime firstReported;
  final DateTime lastReported;
  final bool isActive;

  OutbreakAlert({
    required this.id,
    required this.disease,
    required this.crop,
    required this.geohash,
    required this.caseCount,
    required this.centerLat,
    required this.centerLng,
    required this.firstReported,
    required this.lastReported,
    required this.isActive,
  });

  factory OutbreakAlert.fromJson(Map<String, dynamic> json) {
    return OutbreakAlert(
      id: json['id'] ?? '',
      disease: json['disease'] ?? '',
      crop: json['crop'] ?? '',
      geohash: json['geohash'] ?? '',
      caseCount: json['case_count'] ?? 0,
      centerLat: (json['center_lat'] as num?)?.toDouble() ?? 0.0,
      centerLng: (json['center_lng'] as num?)?.toDouble() ?? 0.0,
      firstReported: json['first_reported'] != null
          ? DateTime.tryParse(json['first_reported']) ?? DateTime.now()
          : DateTime.now(),
      lastReported: json['last_reported'] != null
          ? DateTime.tryParse(json['last_reported']) ?? DateTime.now()
          : DateTime.now(),
      isActive: json['is_active'] ?? true,
    );
  }
}
