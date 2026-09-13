import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../services/api_service.dart';
import '../services/location_service.dart';
import '../services/localization_service.dart';
import 'result_screen.dart';

// ── Supported crop definitions ─────────────────────────────────────────────
class _CropOption {
  final String label;      // English key
  final String? apiName;   // Name sent to backend (null = auto-detect)
  final String emoji;

  const _CropOption({required this.label, required this.emoji, this.apiName});
}

const List<_CropOption> _kCrops = [
  _CropOption(label: 'Auto',       emoji: '🌿', apiName: null),
  _CropOption(label: 'Apple',      emoji: '🍎', apiName: 'Apple'),
  _CropOption(label: 'Blueberry',  emoji: '🫐', apiName: 'Blueberry'),
  _CropOption(label: 'Cherry',     emoji: '🍒', apiName: 'Cherry (including sour)'),
  _CropOption(label: 'Corn',       emoji: '🌽', apiName: 'Corn (maize)'),
  _CropOption(label: 'Grape',      emoji: '🍇', apiName: 'Grape'),
  _CropOption(label: 'Orange',     emoji: '🍊', apiName: 'Orange'),
  _CropOption(label: 'Peach',      emoji: '🍑', apiName: 'Peach'),
  _CropOption(label: 'Pepper',     emoji: '🌶️', apiName: 'Pepper, bell'),
  _CropOption(label: 'Potato',     emoji: '🥔', apiName: 'Potato'),
  _CropOption(label: 'Raspberry',  emoji: '🍓', apiName: 'Raspberry'),
  _CropOption(label: 'Soybean',    emoji: '🫘', apiName: 'Soybean'),
  _CropOption(label: 'Squash',     emoji: '🎃', apiName: 'Squash'),
  _CropOption(label: 'Strawberry', emoji: '🍓', apiName: 'Strawberry'),
  _CropOption(label: 'Tomato',     emoji: '🍅', apiName: 'Tomato'),
];

// ─────────────────────────────────────────────────────────────────────────────

class CameraScreen extends StatefulWidget {
  const CameraScreen({super.key});

  @override
  State<CameraScreen> createState() => _CameraScreenState();
}

class _CameraScreenState extends State<CameraScreen> {
  final ImagePicker _picker = ImagePicker();
  bool _isLoading = false;
  String _statusMessage = '';
  int _selectedCropIndex = 0; // 0 = Auto-detect

  Future<void> _processImage(ImageSource source) async {
    final locale = LocaleController.instance;
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
        _statusMessage = locale.text('analyzing_image');
      });

      final Uint8List imageBytes = await pickedFile.readAsBytes();
      final selectedCrop = _kCrops[_selectedCropIndex].apiName;

      // 1. Call ML Model for diagnosis (with optional crop hint)
      final result = await ApiService.diagnoseLeaf(
        imageBytes,
        filename: pickedFile.name,
        selectedCrop: selectedCrop,
      );

      // 2. Fetch location for area reporting
      setState(() {
        _statusMessage = locale.text('detecting_location');
      });

      final position = await LocationService.getCurrentLocation();
      final lat = position?.latitude ?? 14.6819;
      final lng = position?.longitude ?? 77.6006;

      if (!mounted) return;
      setState(() => _isLoading = false);

      // 3. Navigate to Result Screen (reporting will be confirmed 1-click by user)
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
      if (!mounted) return;
      setState(() => _isLoading = false);
      showDialog(
        context: context,
        builder: (_) => AlertDialog(
          backgroundColor: const Color(0xFF16251E),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Row(
            children: [
              const Icon(Icons.warning_amber_rounded,
                  color: Colors.amberAccent, size: 24),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  locale.text('ood_title'),
                  style: const TextStyle(color: Colors.white, fontSize: 16),
                ),
              ),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                e.message,
                style: const TextStyle(
                    color: Colors.white70, fontSize: 14, height: 1.4),
              ),
              const SizedBox(height: 12),
              Text(
                locale.text('ood_tip'),
                style: const TextStyle(
                    color: Color(0xFF10B981), fontSize: 13, height: 1.3),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text(
                locale.text('try_again'),
                style: const TextStyle(
                  color: Color(0xFF10B981),
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _isLoading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error: $e'),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }

  Widget _buildCropSelector(LocaleController locale) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 8),
          child: Text(
            locale.text('select_crop_label'),
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.bold,
              color: Colors.white38,
              letterSpacing: 1.2,
            ),
          ),
        ),
        SizedBox(
          height: 72,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: _kCrops.length,
            separatorBuilder: (_, __) => const SizedBox(width: 8),
            itemBuilder: (context, index) {
              final crop = _kCrops[index];
              final isSelected = _selectedCropIndex == index;
              final localizedCropName =
                  locale.text('crop_${crop.label}');

              return GestureDetector(
                onTap: () => setState(() => _selectedCropIndex = index),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  curve: Curves.easeOut,
                  width: 72,
                  padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 4),
                  decoration: BoxDecoration(
                    color: isSelected
                        ? const Color(0xFF10B981)
                        : const Color(0xFF16251E),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: isSelected
                          ? const Color(0xFF10B981)
                          : const Color(0xFF263F33),
                      width: 1.5,
                    ),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(crop.emoji, style: const TextStyle(fontSize: 22)),
                      const SizedBox(height: 3),
                      Text(
                        localizedCropName,
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          color: isSelected ? Colors.white : Colors.white70,
                        ),
                        textAlign: TextAlign.center,
                        overflow: TextOverflow.ellipsis,
                        maxLines: 1,
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final locale = LocaleController.instance;
    final selectedCrop = _kCrops[_selectedCropIndex];
    final localizedCropName = locale.text('crop_${selectedCrop.label}');
    final isGuided = _selectedCropIndex != 0;

    return Scaffold(
      backgroundColor: const Color(0xFF0F1713),
      body: _isLoading
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const CircularProgressIndicator(color: Color(0xFF10B981)),
                  const SizedBox(height: 20),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 24.0),
                    child: Text(
                      _statusMessage,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Colors.white70, fontSize: 14),
                    ),
                  ),
                ],
              ),
            )
          : SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 16),
              child: Column(
                children: [
                  // ── Hero Camera Icon ─────────────────────────────────────
                  Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: const Color(0xFF16251E),
                      shape: BoxShape.circle,
                      border: Border.all(
                          color: const Color(0xFF10B981), width: 2),
                    ),
                    child: const Icon(
                      Icons.camera_alt_rounded,
                      size: 64,
                      color: Color(0xFF10B981),
                    ),
                  ),
                  const SizedBox(height: 16),

                  Text(
                    locale.text('check_my_crop'),
                    style: const TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 6),

                  Text(
                    isGuided
                        ? '${locale.text('guided_mode_prefix')}$localizedCropName${locale.text('guided_mode_suffix')}'
                        : locale.text('photo_guide_desc'),
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 13,
                      color: isGuided
                          ? const Color(0xFF10B981)
                          : Colors.white60,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 20),

                  // ── Crop Selector ──────────────────────────────────────
                  _buildCropSelector(locale),
                  const SizedBox(height: 24),

                  // ── Action Buttons ─────────────────────────────────────
                  SizedBox(
                    width: double.infinity,
                    height: 54,
                    child: ElevatedButton.icon(
                      onPressed: () => _processImage(ImageSource.camera),
                      icon: const Icon(Icons.camera_alt, size: 22),
                      label: Text(
                        locale.text('btn_take_photo'),
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF10B981),
                        foregroundColor: Colors.white,
                        elevation: 3,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    height: 54,
                    child: OutlinedButton.icon(
                      onPressed: () => _processImage(ImageSource.gallery),
                      icon: const Icon(Icons.photo_library, size: 22),
                      label: Text(
                        locale.text('btn_gallery'),
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.white,
                        side: const BorderSide(color: Color(0xFF263F33), width: 1.5),
                        backgroundColor: const Color(0xFF16251E),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}
