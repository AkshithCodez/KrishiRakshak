import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/outbreak_alert.dart';
import '../services/api_service.dart';

class OutbreakScreen extends StatefulWidget {
  const OutbreakScreen({super.key});

  @override
  State<OutbreakScreen> createState() => _OutbreakScreenState();
}

class _OutbreakScreenState extends State<OutbreakScreen> {
  late Future<List<OutbreakAlert>> _outbreaksFuture;

  @override
  void initState() {
    super.initState();
    _outbreaksFuture = ApiService.fetchOutbreaks();
  }

  Future<void> _refresh() async {
    setState(() {
      _outbreaksFuture = ApiService.fetchOutbreaks();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F1713),
      appBar: AppBar(
        title: const Text('Regional Outbreak Alerts'),
        backgroundColor: const Color(0xFF16251E),
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _refresh,
          ),
        ],
      ),
      body: FutureBuilder<List<OutbreakAlert>>(
        future: _outbreaksFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator(color: Color(0xFF10B981)));
          }

          final alerts = snapshot.data ?? [];
          if (alerts.isEmpty) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(24.0),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.shield_outlined, color: Color(0xFF10B981), size: 64),
                    SizedBox(height: 16),
                    Text(
                      'No Active Outbreaks in Your Area',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
                    ),
                    SizedBox(height: 8),
                    Text(
                      'Regional alerts are triggered when 3 or more farmers in a 5km radius report matching crop diseases.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.white54, fontSize: 13),
                    ),
                  ],
                ),
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: _refresh,
            color: const Color(0xFF10B981),
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: alerts.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (context, index) {
                final alert = alerts[index];
                final dateStr = DateFormat('dd MMM yyyy').format(alert.lastReported);

                return Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFF221616),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFF5C2626)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              const Icon(Icons.warning_rounded, color: Colors.redAccent, size: 20),
                              const SizedBox(width: 8),
                              Text(
                                '${alert.crop} Outbreak',
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 16,
                                  color: Colors.white,
                                ),
                              ),
                            ],
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: Colors.redAccent,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              '${alert.caseCount} Reports',
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Disease: ${alert.disease}',
                        style: const TextStyle(fontSize: 14, color: Colors.redAccent, fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Cluster Region: Cell ${alert.geohash} (~5km area) • Last active: $dateStr',
                        style: const TextStyle(fontSize: 12, color: Colors.white54),
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
