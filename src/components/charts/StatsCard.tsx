import { IonCard, IonCardContent, IonIcon } from '@ionic/react';
import { 
  businessOutline, 
  hardwareChipOutline, 
  alertCircleOutline,
  notificationsOutline 
} from 'ionicons/icons';

interface StatsCardProps {
  title: string;
  value: number | string;
  icon?: string;
  color?: string;
  subtitle?: string;
}

const iconMap: Record<string, string> = {
  'business-outline': businessOutline,
  'hardware-chip-outline': hardwareChipOutline,
  'alert-circle-outline': alertCircleOutline,
  'notifications-outline': notificationsOutline,
};

export default function StatsCard({ title, value, icon, color = 'primary', subtitle }: StatsCardProps) {
  const iconName = icon ? iconMap[icon] || businessOutline : businessOutline;

  return (
    <IonCard>
      <IonCardContent style={{ textAlign: 'center' }}>
        <IonIcon 
          icon={iconName} 
          style={{ 
            fontSize: '32px', 
            color: `var(--ion-color-${color})` 
          }} 
        />
        <h2 style={{ margin: '8px 0 4px 0', fontSize: '28px', fontWeight: 'bold' }}>
          {value}
        </h2>
        <p style={{ margin: '0', fontSize: '14px', color: 'var(--ion-color-medium)' }}>
          {title}
        </p>
        {subtitle && (
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--ion-color-medium)' }}>
            {subtitle}
          </p>
        )}
      </IonCardContent>
    </IonCard>
  );
}