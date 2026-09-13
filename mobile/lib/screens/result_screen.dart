import 'dart:typed_data';
import 'package:flutter/material.dart';
import '../models/scan_result.dart';
import '../services/api_service.dart';
import '../services/localization_service.dart';

class ResultScreen extends StatefulWidget {
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
  State<ResultScreen> createState() => _ResultScreenState();
}

class _ResultScreenState extends State<ResultScreen> {
  bool _isReporting = false;
  bool _isReported = false;

  Future<void> _handleConfirmReport() async {
    final locale = LocaleController.instance;

    final shouldReport = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: const Color(0xFF16251E),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: [
            const Icon(Icons.campaign_rounded, color: Color(0xFF10B981), size: 24),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                locale.text('report_confirm_title'),
                style: const TextStyle(color: Colors.white, fontSize: 16),
              ),
            ),
          ],
        ),
        content: Text(
          '${locale.text('report_prompt_desc')}\n\n'
          '${widget.result.crop} — ${widget.result.disease}',
          style: const TextStyle(color: Colors.white70, fontSize: 14, height: 1.4),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(
              locale.text('cancel'),
              style: const TextStyle(color: Colors.white54),
            ),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF10B981),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
            child: Text(locale.text('confirm')),
          ),
        ],
      ),
    );

    if (shouldReport != true) return;

    setState(() => _isReporting = true);

    try {
      await ApiService.logScanToBackend(
        result: widget.result,
        latitude: widget.latitude,
        longitude: widget.longitude,
      );

      if (!mounted) return;
      setState(() {
        _isReporting = false;
        _isReported = true;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(locale.text('btn_reported_done')),
          backgroundColor: const Color(0xFF059669),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _isReporting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error reporting scan: $e'),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final locale = LocaleController.instance;
    final isHealthy = widget.result.isHealthy;
    final confPercent = (widget.result.confidence * 100).toInt();

    return Scaffold(
      backgroundColor: const Color(0xFF0F1713),
      appBar: AppBar(
        title: Text(
          locale.text('result_title'),
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
        backgroundColor: const Color(0xFF16251E),
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── AI Assessment Disclaimer Banner ─────────────────────────
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFF262112),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFF5C4716)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.info_outline, color: Colors.amberAccent, size: 20),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      locale.text('initial_ai_banner'),
                      style: const TextStyle(
                        fontSize: 12,
                        color: Colors.amberAccent,
                        height: 1.3,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // ── Leaf Preview Image ──────────────────────────────────────
            ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: Container(
                height: 220,
                width: double.infinity,
                decoration: BoxDecoration(
                  border: Border.all(color: const Color(0xFF263F33)),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Image.memory(widget.imageBytes, fit: BoxFit.cover),
              ),
            ),
            const SizedBox(height: 18),

            // ── Primary Diagnosis Card ──────────────────────────────────
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: const Color(0xFF16251E),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: isHealthy
                      ? const Color(0xFF10B981)
                      : const Color(0xFFEF4444),
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
                        widget.result.crop.toUpperCase(),
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF10B981),
                          letterSpacing: 1.2,
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: isHealthy
                              ? Colors.green.withValues(alpha: 0.2)
                              : Colors.red.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          '$confPercent% ${locale.text('confidence_match')}',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: isHealthy
                                ? Colors.greenAccent
                                : Colors.redAccent,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    locale.text('possible_disease'),
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: Colors.white54,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    widget.result.disease,
                    style: const TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),

            // ── Agronomic Treatment Action ──────────────────────────────
            Text(
              locale.text('treatment_action'),
              style: const TextStyle(
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
                  const Icon(Icons.healing_outlined,
                      color: Color(0xFF10B981), size: 22),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      widget.result.treatment,
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
            const SizedBox(height: 18),

            // ── Top-3 Alternatives ──────────────────────────────────────
            if (widget.result.top3.length > 1) ...[
              Text(
                locale.text('alternative_candidates'),
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                locale.text('alternative_candidates_sub'),
                style: const TextStyle(fontSize: 11, color: Colors.white38),
              ),
              const SizedBox(height: 10),
              Container(
                decoration: BoxDecoration(
                  color: const Color(0xFF16251E),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFF263F33)),
                ),
                child: Column(
                  children: [
                    for (int i = 1; i < widget.result.top3.length; i++) ...[
                      if (i > 1)
                        const Divider(height: 1, color: Color(0xFF263F33)),
                      _Top3Row(candidate: widget.result.top3[i]),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 20),
            ],

            // ── 1-Click Disease Reporting Card ──────────────────────────
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: _isReported
                    ? const Color(0xFF0F261B)
                    : const Color(0xFF1A2620),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: _isReported
                      ? const Color(0xFF10B981)
                      : const Color(0xFF2D473A),
                  width: 1.5,
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(
                        _isReported ? Icons.check_circle : Icons.campaign_rounded,
                        color: _isReported
                            ? const Color(0xFF10B981)
                            : Colors.amberAccent,
                        size: 24,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          _isReported
                              ? locale.text('btn_reported_done')
                              : locale.text('report_prompt_title'),
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                            color: _isReported
                                ? const Color(0xFF10B981)
                                : Colors.white,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    locale.text('report_prompt_desc'),
                    style: const TextStyle(fontSize: 12, color: Colors.white60),
                  ),
                  const SizedBox(height: 14),
                  if (!_isReported)
                    SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: ElevatedButton(
                        onPressed: _isReporting ? null : _handleConfirmReport,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF10B981),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: _isReporting
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(
                                    color: Colors.white, strokeWidth: 2),
                              )
                            : Text(
                                locale.text('btn_report_disease'),
                                style: const TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                      ),
                    )
                  else
                    Row(
                      children: [
                        const Icon(Icons.satellite_alt_rounded,
                            color: Color(0xFF10B981), size: 16),
                        const SizedBox(width: 8),
                        Text(
                          'Cell geohash logged • (${widget.latitude.toStringAsFixed(2)}, ${widget.longitude.toStringAsFixed(2)})',
                          style: const TextStyle(
                              fontSize: 11, color: Colors.white38),
                        ),
                      ],
                    ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // ── Back to Scanner ─────────────────────────────────────────
            SizedBox(
              width: double.infinity,
              height: 52,
              child: OutlinedButton(
                onPressed: () => Navigator.pop(context),
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.white,
                  side: const BorderSide(color: Color(0xFF263F33), width: 1.5),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                child: Text(
                  locale.text('btn_back_scan'),
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Top-3 row widget ────────────────────────────────────────────────────────
class _Top3Row extends StatelessWidget {
  final PredictionCandidate candidate;

  const _Top3Row({required this.candidate});

  @override
  Widget build(BuildContext context) {
    final pct = (candidate.confidence * 100).toInt();
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  '${candidate.crop} — ${candidate.disease}',
                  style: const TextStyle(
                      fontSize: 13,
                      color: Colors.white70,
                      fontWeight: FontWeight.w600),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Text(
                '$pct%',
                style: const TextStyle(
                    fontSize: 13,
                    color: Colors.white38,
                    fontWeight: FontWeight.bold),
              ),
            ],
          ),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: candidate.confidence,
              backgroundColor: const Color(0xFF263F33),
              valueColor:
                  const AlwaysStoppedAnimation<Color>(Color(0xFF059669)),
              minHeight: 4,
            ),
          ),
        ],
      ),
    );
  }
}
