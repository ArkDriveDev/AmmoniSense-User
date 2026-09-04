import React from 'react';
import { IonIcon } from '@ionic/react';
import { closeOutline } from 'ionicons/icons';

export interface MapLegendProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MapLegend: React.FC<MapLegendProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: '64px',
        right: '12px',
        zIndex: 1050,
        background: 'rgba(255, 255, 255, 0.96)',
        backdropFilter: 'blur(10px)',
        borderRadius: '16px',
        padding: '12px 16px',
        boxShadow: '0 8px 32px rgba(15, 60, 92, 0.22)',
        border: '1px solid rgba(226, 232, 240, 0.9)',
        width: '230px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontWeight: 800, fontSize: '13px', color: '#0f172a' }}>🗺️ Spatial Map Legend</span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', color: '#64748b' }}
        >
          <IonIcon icon={closeOutline} style={{ fontSize: '18px' }} />
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', color: '#334155' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '14px', height: '14px', borderRadius: '3px', background: '#fbbf24', border: '1.5px dashed #d97706' }} />
          <span><b>Odor Impact Zone</b> (Polygon)</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '14px', height: '14px', borderRadius: '3px', background: 'rgba(29, 93, 155, 0.2)', border: '1.5px dashed #1D5D9B' }} />
          <span><b>Site Area Coverage</b> (Polygon)</span>
        </div>

        <div style={{ borderTop: '1px solid #f1f5f9', margin: '3px 0' }} />
        <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Ammonia Levels (PPM)</span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#22c55e' }} />
          <span><b>0 – 5 PPM</b>: Normal (Safe)</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#eab308' }} />
          <span><b>5 – 10 PPM</b>: Warning (Moderate)</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f97316' }} />
          <span><b>10 – 20 PPM</b>: High (Action Req.)</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }} />
          <span><b>&gt; 20 PPM</b>: Critical (Hazardous)</span>
        </div>

        <div style={{ borderTop: '1px solid #f1f5f9', margin: '3px 0' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#1D5D9B' }} />
          <span><b>Monitoring Site</b> (Facility)</span>
        </div>
      </div>
    </div>
  );
};

export default MapLegend;
