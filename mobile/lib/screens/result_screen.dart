import 'dart:typed_data';
import 'package:flutter/material.dart';
import '../models/scan_result.dart';

class ResultScreen extends StatelessWidget {
  final ScanResult result;
  final Uint8List imageBytes;
  final double latitude;
  final double longitude;

  const ResultScreen({
    super.key,
    required this.result,
    required this.imageBytes,
    required this.latitude,
    required this.longitude,
  });

  @override
  Widget build(BuildContext context) {
    final isHealthy = result.isHealthy;
    final confPercent = (result.confidence * 100).toInt();

    return Scaffold(
      backgroundColor: const Color(0xFF0F1713),
      appBar: AppBar(
        title: const Text('Diagnosis Result'),
        backgroundColor: const Color(0xFF16251E),
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Preview Image
            ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: Container(
                height: 220,
                width: double.infinity,
                decoration: BoxDecoration(
                  border: Border.all(color: const Color(0xFF263F33)),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Image.memory(
                  imageBytes,
                  fit: BoxFit.cover,
                ),
              ),
            ),
            const SizedBox(height: 20),

            // Status Card
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: const Color(0xFF16251E),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: isHealthy ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                  width: 1.5,
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        result.crop.toUpperCase(),
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF10B981),
                          letterSpacing: 1.2,
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: isHealthy ? Colors.green.withOpacity(0.2) : Colors.red.withOpacity(0.2),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          '$confPercent% Match',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: isHealthy ? Colors.greenAccent : Colors.redAccent,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    result.disease,
                    style: const TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Treatment & Action Card
            const Text(
              'Recommended Agronomic Action',
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFF16251E),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFF263F33)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.medical_services_outlined, color: Color(0xFF10B981), size: 22),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      result.treatment,
                      style: const TextStyle(
                        fontSize: 14,
                        color: Colors.white70,
                        height: 1.4,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Community Outbreak Surveillance Notice
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFF13201A),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  const Icon(Icons.satellite_alt_outlined, color: Colors.tealAccent, size: 20),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Report logged to Community Outbreak Tracker (${latitude.toStringAsFixed(3)}, ${longitude.toStringAsFixed(3)})',
                      style: const TextStyle(fontSize: 12, color: Colors.white54),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Done Button
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(context),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF10B981),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text('Back to Scanner', style: TextStyle(fontSize: 16)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
