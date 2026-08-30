import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../services/api_service.dart';
import '../services/location_service.dart';
import 'result_screen.dart';


class CameraScreen extends StatefulWidget {
  const CameraScreen({super.key});

  @override
  State<CameraScreen> createState() => _CameraScreenState();
}

class _CameraScreenState extends State<CameraScreen> {
  final ImagePicker _picker = ImagePicker();
  bool _isLoading = false;
  String _statusMessage = '';

  Future<void> _processImage(ImageSource source) async {
    try {
      final XFile? pickedFile = await _picker.pickImage(
        source: source,
        maxWidth: 1024,
        maxHeight: 1024,
        imageQuality: 85,
      );

      if (pickedFile == null) return;

      setState(() {
        _isLoading = true;
        _statusMessage = 'Analyzing crop leaf image...';
      });

      final Uint8List imageBytes = await pickedFile.readAsBytes();

      // 1. Call ML Model for diagnosis
      final result = await ApiService.diagnoseLeaf(imageBytes, filename: pickedFile.name);

      // 2. Fetch location in parallel
      setState(() {
        _statusMessage = 'Detecting location & logging report...';
      });

      final position = await LocationService.getCurrentLocation();
      final lat = position?.latitude ?? 14.6819; // Fallback demo coord
      final lng = position?.longitude ?? 77.6006;

      // 3. Log scan to backend with location
      await ApiService.logScanToBackend(
        result: result,
        latitude: lat,
        longitude: lng,
      );

      if (!mounted) return;
      setState(() {
        _isLoading = false;
      });

      // 4. Navigate to Result Screen
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => ResultScreen(
            result: result,
            imageBytes: imageBytes,
            latitude: lat,
            longitude: lng,
          ),
        ),
      );
    } on OodException catch (e) {
      // OOD rejection: show a friendly dialog — NOT a snack bar
      if (!mounted) return;
      setState(() => _isLoading = false);
      showDialog(
        context: context,
        builder: (_) => AlertDialog(
          backgroundColor: const Color(0xFF16251E),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Row(
            children: [
              Icon(Icons.warning_amber_rounded, color: Colors.amberAccent, size: 24),
              SizedBox(width: 8),
              Text('Image Not Recognized', style: TextStyle(color: Colors.white, fontSize: 16)),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                e.message,
                style: const TextStyle(color: Colors.white70, fontSize: 14, height: 1.4),
              ),
              const SizedBox(height: 12),
              Text(
                'Confidence: ${(e.confidence * 100).toStringAsFixed(1)}%',
                style: const TextStyle(color: Colors.white38, fontSize: 12),
              ),
              const SizedBox(height: 12),
              const Text(
                'Supported crops: Tomato, Potato, Apple, Corn, Peach, Cherry, Pepper, Blueberry, Raspberry, Soybean, Squash, Strawberry, Orange, Grape.',
                style: TextStyle(color: Colors.white38, fontSize: 11, height: 1.3),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Try Again', style: TextStyle(color: Color(0xFF10B981))),
            ),
          ],
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error diagnosing leaf: $e'),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F1713),
      appBar: AppBar(
        title: const Text('KrishiRakshak Diagnostic'),
        backgroundColor: const Color(0xFF16251E),
        elevation: 0,
      ),
      body: Center(
        child: _isLoading
            ? Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const CircularProgressIndicator(color: Color(0xFF10B981)),
                  const SizedBox(height: 20),
                  Text(
                    _statusMessage,
                    style: const TextStyle(color: Colors.white70, fontSize: 14),
                  ),
                ],
              )
            : Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24.0),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(28),
                      decoration: BoxDecoration(
                        color: const Color(0xFF16251E),
                        shape: BoxShape.circle,
                        border: Border.all(color: const Color(0xFF10B981), width: 2),
                      ),
                      child: const Icon(
                        Icons.camera_alt_outlined,
                        size: 72,
                        color: Color(0xFF10B981),
                      ),
                    ),
                    const SizedBox(height: 28),
                    const Text(
                      'Photograph Crop Leaf',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 10),
                    const Text(
                      'Hold your camera close to a single diseased or healthy leaf with good lighting for best diagnostic accuracy.',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 13, color: Colors.white60, height: 1.4),
                    ),
                    const SizedBox(height: 36),
                    SizedBox(
                      width: double.infinity,
                      height: 52,
                      child: ElevatedButton.icon(
                        onPressed: () => _processImage(ImageSource.camera),
                        icon: const Icon(Icons.camera),
                        label: const Text('Take Photo with Camera', style: TextStyle(fontSize: 16)),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF10B981),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),
                    SizedBox(
                      width: double.infinity,
                      height: 52,
                      child: OutlinedButton.icon(
                        onPressed: () => _processImage(ImageSource.gallery),
                        icon: const Icon(Icons.photo_library),
                        label: const Text('Select from Gallery', style: TextStyle(fontSize: 16)),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.white,
                          side: const BorderSide(color: Color(0xFF263F33)),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
      ),
    );
  }
}
