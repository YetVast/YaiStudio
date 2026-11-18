'use client';

import React from 'react';
import { Plug, ShieldCheck, ExternalLink, Info, CheckCircle2 } from 'lucide-react';
import styles from './ConnectedApps.module.css';

interface ProductIntegration {
  name: string;
  slug: string;
  description: string;
  scope: string;
  status: 'active' | 'available';
}

const PRODUCTS: ProductIntegration[] = [
  {
    name: 'Cogmit',
    slug: 'cogmit',
    description: 'Personal publishing and deep cognition platform under Yet Vast Solutions.',
    scope: 'Read approved context, submit interaction activity, propose memory candidates',
    status: 'active',
  },
  {
    name: 'Fyuniverse',
    slug: 'fyuniverse',
    description: 'Interactive media and universe exploration ecosystem.',
    scope: 'Read approved preferences, submit interaction activity',
    status: 'available',
  },
  {
    name: 'VastComm',
    slug: 'vastcomm',
    description: 'Unified communication and discussion architecture.',
    scope: 'Propose memory candidates, query user preferences',
    status: 'available',
  },
];

export default function ConnectedAppsPage() {
  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Connected Ecosystem Products</h1>
          <p className={styles.subtitle}>
            Independent Yet Vast Solutions products integrate with YAI through secure API
            contracts. Product data remains product-owned; YAI manages only user-approved
            personal context.
          </p>
        </div>
      </div>

      {/* Info notice */}
      <div className={styles.noticeBox}>
        <Info size={18} className={styles.noticeIcon} />
        <div>
          <strong>Architectural Authority Boundary</strong>
          <p>
            Yet Vast Auth remains authoritative for product application registration and OAuth
            approval. YAI Studio manages only YAI-specific personal intelligence access and memory
            contribution consent.
          </p>
        </div>
      </div>

      {/* Product List */}
      <div className={styles.productGrid}>
        {PRODUCTS.map((prod) => (
          <div key={prod.slug} className={styles.productCard}>
            <div className={styles.cardHeader}>
              <div className={styles.productIdentity}>
                <Plug size={18} className={styles.productIcon} />
                <h3>{prod.name}</h3>
              </div>
              <span
                className={`${styles.statusPill} ${
                  prod.status === 'active' ? styles.activePill : styles.availablePill
                }`}
              >
                {prod.status === 'active' ? (
                  <>
                    <CheckCircle2 size={12} />
                    <span>Connected</span>
                  </>
                ) : (
                  <span>Available</span>
                )}
              </span>
            </div>

            <p className={styles.productDesc}>{prod.description}</p>

            <div className={styles.scopeSection}>
              <strong>Integration Scope:</strong>
              <p>{prod.scope}</p>
            </div>

            <div className={styles.cardFooter}>
              <span className={styles.protocolBadge}>API v0 Contract</span>
              <span className={styles.authBadge}>Yet Vast Auth Bound</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
