'use client';

import React, { useEffect, useState } from 'react';
import { Activity, Clock, Cpu, Filter, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';
import type { ActivityEvent } from '@/types/personal-intelligence';
import Button from '@/components/ui/Button';
import styles from './Activity.module.css';

export default function ActivityPage() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [productFilter, setProductFilter] = useState<string>('all');

  const fetchActivity = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/activity?limit=50');
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } catch {
      setErrorMessage('Failed to load activity ledger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivity();
  }, []);

  const filteredEvents = events.filter((e) => {
    if (productFilter === 'all') return true;
    return e.sourceProduct.toLowerCase() === productFilter.toLowerCase();
  });

  const uniqueProducts = Array.from(new Set(events.map((e) => e.sourceProduct)));

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Intelligence Activity Ledger</h1>
          <p className={styles.subtitle}>
            Partitioned audit log of AI interactions across YAI Studio and authorized Yet Vast
            products. Activity records are distinct from durable personal memories.
          </p>
        </div>
        <Button onClick={fetchActivity} variant="outline" size="sm" loading={loading}>
          <RefreshCw size={14} />
          <span>Refresh</span>
        </Button>
      </div>

      {errorMessage && (
        <div className={styles.errorBanner} role="alert">
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className={styles.filterBar}>
        <div className={styles.filterLabel}>
          <Filter size={14} />
          <span>Filter by product:</span>
        </div>
        <div className={styles.filterButtons}>
          <button
            onClick={() => setProductFilter('all')}
            className={`${styles.filterPill} ${productFilter === 'all' ? styles.activeFilterPill : ''}`}
          >
            All Products ({events.length})
          </button>
          {uniqueProducts.map((p) => (
            <button
              key={p}
              onClick={() => setProductFilter(p)}
              className={`${styles.filterPill} ${productFilter === p ? styles.activeFilterPill : ''}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Event List */}
      {loading ? (
        <div className={styles.loadingBox}>
          <RefreshCw className={styles.spinner} size={24} />
          <p>Reading activity ledger from repository...</p>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className={styles.emptyBox}>
          <Activity size={36} className={styles.emptyIcon} />
          <h3>No activity recorded</h3>
          <p>
            When you run conversations or when connected Yet Vast products query your personal
            intelligence, events appear here.
          </p>
        </div>
      ) : (
        <div className={styles.eventList}>
          {filteredEvents.map((evt) => (
            <div key={evt.id} className={styles.eventCard}>
              <div className={styles.eventHeader}>
                <div className={styles.eventHeaderLeft}>
                  <span className={styles.productBadge}>{evt.sourceProduct}</span>
                  <span className={styles.modeBadge}>{evt.executionMode}</span>
                  {evt.model && (
                    <span className={styles.modelBadge}>
                      <Cpu size={12} />
                      <span>{evt.model}</span>
                    </span>
                  )}
                </div>
                <div className={styles.eventHeaderRight}>
                  <Clock size={12} />
                  <span>{new Date(evt.timestamp).toLocaleString()}</span>
                </div>
              </div>

              <div className={styles.eventBody}>
                {evt.querySummary && (
                  <div className={styles.queryBlock}>
                    <strong>Query:</strong> {evt.querySummary}
                  </div>
                )}
                {evt.responseSummary && (
                  <div className={styles.responseBlock}>
                    <strong>Response:</strong> {evt.responseSummary}
                  </div>
                )}
              </div>

              <div className={styles.eventFooter}>
                <span className={styles.eventId}>Event ID: <code>{evt.id}</code></span>
                {evt.memoryCandidateIds && evt.memoryCandidateIds.length > 0 && (
                  <span className={styles.candidateBadge}>
                    <Sparkles size={12} />
                    <span>{evt.memoryCandidateIds.length} candidate(s) proposed</span>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
