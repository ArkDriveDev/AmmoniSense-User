import React from 'react';
import { IonCard, IonCardContent, IonBadge, IonIcon } from '@ionic/react';
import { thermometerOutline, waterOutline, batteryChargingOutline, locationOutline, cloudOfflineOutline } from 'ionicons/icons';
import { InspectionTag } from '../../types/inspection';

interface Props {
  tag: InspectionTag;
  onClick?: () => void;
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

export const TagCard: React.FC<Props> = ({ tag, onClick }) => {
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontWeight: 700, fontSize: '15px', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {tag.tag_name}
              </h4>
              <IonBadge color={statusBadgeColor(tag.status)}>
                {tag.ammonia.toFixed(2)} PPM ({tag.status})
              </IonBadge>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px', fontSize: '12px', color: '#64748B' }}>
              <span><IonIcon icon={thermometerOutline} /> {tag.temperature.toFixed(1)}°C</span>
              <span><IonIcon icon={waterOutline} /> {tag.humidity.toFixed(1)}%</span>
              <span><IonIcon icon={batteryChargingOutline} /> {tag.battery}%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', fontSize: '11px', color: '#94A3B8' }}>
              <span><IonIcon icon={locationOutline} /> {tag.latitude.toFixed(4)}, {tag.longitude.toFixed(4)}</span>
              {tag.isOffline && <IonBadge color="warning" style={{ fontSize: '9px' }}><IonIcon icon={cloudOfflineOutline} /> Offline</IonBadge>}
            </div>
          </div>
        </div>
      </IonCardContent>
    </IonCard>
  );
};
export default TagCard;
