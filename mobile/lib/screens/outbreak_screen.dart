import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/outbreak_alert.dart';
import '../services/api_service.dart';
import '../services/localization_service.dart';

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
    final locale = LocaleController.instance;

    return Scaffold(
      backgroundColor: const Color(0xFF0F1713),
      body: FutureBuilder<List<OutbreakAlert>>(
        future: _outbreaksFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(
                child: CircularProgressIndicator(color: Color(0xFF10B981)));
          }

          final alerts = snapshot.data ?? [];

          return RefreshIndicator(
            onRefresh: _refresh,
            color: const Color(0xFF10B981),
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
              children: [
                // ── Header Title & Refresh ──────────────────────────────
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          locale.text('alerts_title'),
                          style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          locale.text('cluster_area'),
                          style: const TextStyle(
                              fontSize: 12, color: Colors.white54),
                        ),
                      ],
                    ),
                    IconButton(
                      icon: const Icon(Icons.refresh, color: Color(0xFF10B981)),
                      onPressed: _refresh,
                      tooltip: 'Refresh',
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                if (alerts.isEmpty)
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
                        const Icon(Icons.shield_outlined,
                            color: Color(0xFF10B981), size: 54),
                        const SizedBox(height: 16),
                        Text(
                          locale.text('no_outbreaks_title'),
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          locale.text('no_outbreaks_desc'),
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            color: Colors.white54,
                            fontSize: 13,
                            height: 1.4,
                          ),
                        ),
                      ],
                    ),
                  )
                else
                  for (final alert in alerts) ...[
                    _buildAlertCard(alert, locale),
                    const SizedBox(height: 12),
                  ],
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildAlertCard(OutbreakAlert alert, LocaleController locale) {
    final dateStr = DateFormat('dd MMM yyyy').format(alert.lastReported);
    final isHighSeverity = alert.caseCount >= 5;
    final localizedCrop = locale.text('crop_${alert.crop}');

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isHighSeverity ? const Color(0xFF241616) : const Color(0xFF241F14),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isHighSeverity
              ? const Color(0xFF6B2B2B)
              : const Color(0xFF6B5324),
          width: 1.2,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Icon(
                    Icons.warning_rounded,
                    color: isHighSeverity ? Colors.redAccent : Colors.amberAccent,
                    size: 22,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    '$localizedCrop ${locale.text('outbreak_tag')}',
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: isHighSeverity
                      ? Colors.redAccent.withValues(alpha: 0.25)
                      : Colors.amber.withValues(alpha: 0.25),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: isHighSeverity ? Colors.redAccent : Colors.amberAccent,
                    width: 1,
                  ),
                ),
                child: Text(
                  '${alert.caseCount} ${locale.text('reports_nearby')}',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: isHighSeverity
                        ? Colors.redAccent
                        : Colors.amberAccent,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            alert.disease,
            style: TextStyle(
              fontSize: 15,
              color: isHighSeverity ? Colors.redAccent : Colors.amberAccent,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              const Icon(Icons.share_location_rounded,
                  size: 14, color: Colors.white38),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  '${locale.text('cluster_area')} (Cell ${alert.geohash}) • ${locale.text('last_active')}: $dateStr',
                  style: const TextStyle(fontSize: 12, color: Colors.white54),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
