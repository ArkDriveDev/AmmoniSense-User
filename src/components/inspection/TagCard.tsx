import React from 'react';
import { IonCard, IonCardContent, IonBadge, IonIcon, IonButton } from '@ionic/react';
import { thermometerOutline, waterOutline, batteryChargingOutline, locationOutline, cloudOfflineOutline, createOutline } from 'ionicons/icons';
import { InspectionTag } from '../../types/inspection';

interface Props {
  tag: InspectionTag;
  onClick?: () => void;
  onEdit?: (tag: InspectionTag) => void;
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

export const TagCard: React.FC<Props> = ({ tag, onClick, onEdit }) => {
  const photo = tag.photo_thumbnail_url || tag.photo_url;

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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
              <h4 style={{ margin: 0, fontWeight: 700, fontSize: '15px', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {tag.tag_name}
              </h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <IonBadge color={statusBadgeColor(tag.status)}>
                  {(Number(tag.ammonia) || 0).toFixed(2)} PPM ({tag.status || 'NORMAL'})
                </IonBadge>
                {onEdit && (
                  <IonButton
                    size="small"
                    fill="clear"
                    color="primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(tag);
                    }}
                    title="Update tag details"
                    style={{ margin: 0, height: '24px' }}
                  >
                    <IonIcon icon={createOutline} slot="icon-only" style={{ fontSize: '16px' }} />
                  </IonButton>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px', fontSize: '12px', color: '#64748B' }}>
              <span><IonIcon icon={thermometerOutline} /> {(Number(tag.temperature) || 0).toFixed(1)}°C</span>
              <span><IonIcon icon={waterOutline} /> {(Number(tag.humidity) || 0).toFixed(1)}%</span>
              <span><IonIcon icon={batteryChargingOutline} /> {tag.battery !== undefined && tag.battery !== null ? Number(tag.battery) : 100}%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', fontSize: '11px', color: '#94A3B8' }}>
              <span><IonIcon icon={locationOutline} /> {(Number(tag.latitude) || 0).toFixed(4)}, {(Number(tag.longitude) || 0).toFixed(4)}</span>
              {tag.isOffline && <IonBadge color="warning" style={{ fontSize: '9px' }}><IonIcon icon={cloudOfflineOutline} /> Offline</IonBadge>}
            </div>
          </div>
        </div>
      </IonCardContent>
    </IonCard>
  );
};
export default TagCard;
