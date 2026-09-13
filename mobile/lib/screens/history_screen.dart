import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/scan_result.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../services/localization_service.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  late Future<List<ScanResult>> _historyFuture;
  String? _phoneNumber;

  @override
  void initState() {
    super.initState();
    _historyFuture = ApiService.fetchDeviceHistory();
    _loadFarmerInfo();
  }

  Future<void> _loadFarmerInfo() async {
    final phone = await AuthService.getPhoneNumber();
    if (mounted) {
      setState(() {
        _phoneNumber = phone;
      });
    }
  }

  Future<void> _refresh() async {
    setState(() {
      _historyFuture = ApiService.fetchDeviceHistory();
    });
  }

  @override
  Widget build(BuildContext context) {
    final locale = LocaleController.instance;

    return Scaffold(
      backgroundColor: const Color(0xFF0F1713),
      body: FutureBuilder<List<ScanResult>>(
        future: _historyFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(
                child: CircularProgressIndicator(color: Color(0xFF10B981)));
          }

          final scans = snapshot.data ?? [];

          return RefreshIndicator(
            onRefresh: _refresh,
            color: const Color(0xFF10B981),
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
              children: [
                // ── Header Title & Farmer Phone Badge ────────────────────
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      locale.text('history_title'),
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.refresh, color: Color(0xFF10B981)),
                      onPressed: _refresh,
                      tooltip: 'Refresh',
                    ),
                  ],
                ),
                if (_phoneNumber != null) ...[
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      const Icon(Icons.phone_android,
                          size: 14, color: Colors.white38),
                      const SizedBox(width: 4),
                      Text(
                        '+91 $_phoneNumber',
                        style: const TextStyle(
                            fontSize: 12, color: Colors.white38),
                      ),
                    ],
                  ),
                ],
                const SizedBox(height: 16),

                if (scans.isEmpty)
                  Container(
                    padding: const EdgeInsets.all(32),
                    decoration: BoxDecoration(
                      color: const Color(0xFF16251E),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFF263F33)),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.history_toggle_off_rounded,
                            size: 48, color: Colors.white24),
                        const SizedBox(height: 16),
                        Text(
                          locale.text('history_empty'),
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            color: Colors.white54,
                            fontSize: 14,
                            height: 1.5,
                          ),
                        ),
                      ],
                    ),
                  )
                else
                  for (final scan in scans) ...[
                    _buildHistoryCard(scan, locale),
                    const SizedBox(height: 12),
                  ],
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildHistoryCard(ScanResult scan, LocaleController locale) {
    final isHealthy = scan.isHealthy;
    final dateStr = DateFormat('dd MMM yyyy, hh:mm a').format(scan.createdAt);
    final localizedCrop = locale.text('crop_${scan.crop}');

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF16251E),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFF263F33)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: isHealthy
                  ? Colors.green.withValues(alpha: 0.15)
                  : Colors.amber.withValues(alpha: 0.15),
              shape: BoxShape.circle,
            ),
            child: Icon(
              isHealthy
                  ? Icons.check_circle_outline
                  : Icons.warning_amber_rounded,
              color: isHealthy ? Colors.greenAccent : Colors.amberAccent,
              size: 24,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '$localizedCrop — ${scan.disease}',
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 15,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  dateStr,
                  style: const TextStyle(fontSize: 12, color: Colors.white54),
                ),
              ],
            ),
          ),
          Text(
            '${(scan.confidence * 100).toInt()}%',
            style: const TextStyle(
              fontWeight: FontWeight.bold,
              color: Color(0xFF10B981),
              fontSize: 15,
            ),
          ),
        ],
      ),
    );
  }
}
