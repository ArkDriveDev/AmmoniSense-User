import React from 'react';
import { IonCard, IonCardContent, IonBadge, IonIcon, IonButton } from '@ionic/react';
import {
  thermometerOutline, waterOutline, batteryChargingOutline,
  locationOutline, cloudOfflineOutline, createOutline, trashOutline,
  alertCircleOutline
} from 'ionicons/icons';
import { InspectionTag, calculateAmmoniaStatus } from '../../types/inspection';
import { getTagAveragePpm } from '../../services/tagService';
import { getViolationCategoryLabel, getViolationCategoryBadgeColor } from '../../constants/violationCategories';

interface Props {
  tag: InspectionTag;
  onClick?: () => void;
  onEdit?: (tag: InspectionTag) => void;
  onDelete?: (tag: InspectionTag) => void;
}

const statusBadgeColor = (status: string) => {
  switch (status) {
    case 'NORMAL': return 'success';
    case 'WARNING': return 'warning';
    case 'HIGH': return 'danger';
    case 'CRITICAL': return 'danger';
    default: return 'medium';
  }
};

export const TagCard: React.FC<Props> = ({ tag, onClick, onEdit, onDelete }) => {
  const photo = tag.photo_url;
  const avg = getTagAveragePpm(tag);
  const status = avg !== null ? calculateAmmoniaStatus(avg) : null;
  const statusLabel = status === 'NORMAL' ? 'SAFE' : status;

  return (
    <IonCard button={!!onClick} onClick={onClick} style={{ margin: '8px 0', borderRadius: '12px' }}>
      <IonCardContent style={{ padding: '12px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {photo ? (
            <img
              src={photo}
              alt={tag.tag_name}
              style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }}
            />
          ) : (
            <div style={{ width: '64px', height: '64px', borderRadius: '8px', background: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', flexShrink: 0 }}>
              No Pic
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '6px' }}>
              <h4 style={{ margin: 0, fontWeight: 700, fontSize: '15px', color: '#0F172A', whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere', lineHeight: 1.3, flex: '1 1 120px' }}>
                {tag.tag_name}
              </h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <IonBadge color={status ? statusBadgeColor(status) : 'medium'}>
                  {avg !== null ? `Avg NH₃: ${avg.toFixed(2)} ppm (${statusLabel})` : 'No readings'}
                </IonBadge>
                {onEdit && (
                  <IonButton
                    size="small"
                    fill="clear"
                    color="primary"
                    disabled={!tag.isOffline}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (tag.isOffline) onEdit(tag);
                    }}
                    title="Update tag details"
                    style={{ margin: 0, height: '24px' }}
                  >
                    <IonIcon icon={createOutline} slot="icon-only" style={{ fontSize: '16px' }} />
                  </IonButton>
                )}
                {onDelete && (
                  <IonButton
                    size="small"
                    fill="clear"
                    color="danger"
                    disabled={!tag.isOffline}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (tag.isOffline) onDelete(tag);
                    }}
                    title="Delete tag"
                    style={{ margin: 0, height: '24px' }}
                  >
                    <IonIcon icon={trashOutline} slot="icon-only" style={{ fontSize: '15px' }} />
                  </IonButton>
                )}
              </div>
            </div>
            {tag.findings && (
              <div style={{ marginTop: '3px' }}>
                <IonBadge
                  color={getViolationCategoryBadgeColor(tag.findings)}
                  style={{ fontSize: '12px', fontWeight: 700, padding: '2px 6px' }}
                >
                  <IonIcon icon={alertCircleOutline} style={{ verticalAlign: 'middle', marginRight: '3px' }} />
                  {getViolationCategoryLabel(tag.findings)}
                </IonBadge>
              </div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px', fontSize: '12px', color: '#64748B' }}>
              <span><IonIcon icon={thermometerOutline} /> {tag.temperature !== undefined && tag.temperature !== null ? `${Number(tag.temperature).toFixed(1)}°C` : '—'}</span>
              <span><IonIcon icon={waterOutline} /> {tag.humidity !== undefined && tag.humidity !== null ? `${Number(tag.humidity).toFixed(1)}%` : '—'}</span>
              <span><IonIcon icon={batteryChargingOutline} /> {tag.battery !== undefined && tag.battery !== null ? `${Number(tag.battery)}%` : '—'}</span>
            </div>
            {tag.notes && (
              <div style={{ marginTop: '3px', fontSize: '12px', color: '#475569', fontStyle: 'italic', whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere', lineHeight: 1.35 }}>
                "{tag.notes}"
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px', marginTop: '4px', fontSize: '12px', color: '#94A3B8' }}>
              <span><IonIcon icon={locationOutline} /> {(Number(tag.latitude) || 0).toFixed(4)}, {(Number(tag.longitude) || 0).toFixed(4)}</span>
              {tag.isOffline && <IonBadge color="warning" style={{ fontSize: '12px' }}><IonIcon icon={cloudOfflineOutline} /> Offline — not synced</IonBadge>}
            </div>
          </div>
        </div>
      </IonCardContent>
    </IonCard>
  );
};
export default TagCard;
