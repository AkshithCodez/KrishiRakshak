import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/scan_result.dart';
import '../services/api_service.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  late Future<List<ScanResult>> _historyFuture;

  @override
  void initState() {
    super.initState();
    _historyFuture = ApiService.fetchDeviceHistory();
  }

  Future<void> _refresh() async {
    setState(() {
      _historyFuture = ApiService.fetchDeviceHistory();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F1713),
      appBar: AppBar(
        title: const Text('My Scan History'),
        backgroundColor: const Color(0xFF16251E),
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _refresh,
          ),
        ],
      ),
      body: FutureBuilder<List<ScanResult>>(
        future: _historyFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator(color: Color(0xFF10B981)));
          }

          if (snapshot.hasError) {
            return Center(
              child: Text(
                'Could not load history: ${snapshot.error}',
                style: const TextStyle(color: Colors.white60),
              ),
            );
          }

          final scans = snapshot.data ?? [];
          if (scans.isEmpty) {
            return const Center(
              child: Text(
                'No past scans found.\nScan a leaf to start building your record.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white54, fontSize: 14),
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: _refresh,
            color: const Color(0xFF10B981),
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: scans.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (context, index) {
                final scan = scans[index];
                final isHealthy = scan.isHealthy;
                final dateStr = DateFormat('dd MMM yyyy, hh:mm a').format(scan.createdAt);

                return Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFF16251E),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFF263F33)),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: isHealthy ? Colors.green.withValues(alpha: 0.15) : Colors.amber.withValues(alpha: 0.15),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          isHealthy ? Icons.check_circle_outline : Icons.warning_amber_rounded,
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
                              '${scan.crop} — ${scan.disease}',
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
                          fontSize: 14,
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }
}
