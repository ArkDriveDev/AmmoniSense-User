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

  const colorGradients: Record<string, string> = {
    primary: 'linear-gradient(135deg, #1D5D9B 0%, #0F3C5C 100%)',
    secondary: 'linear-gradient(135deg, #008B74 0%, #006E5C 100%)',
    success: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
    warning: 'linear-gradient(135deg, #D97706 0%, #B45309 100%)',
    danger: 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)',
  };

  const bgGradient = colorGradients[color] || colorGradients.primary;

  return (
    <IonCard className="stats-card">
      <IonCardContent style={{ padding: '16px', textAlign: 'center' }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '14px',
          background: bgGradient,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '10px',
          boxShadow: '0 4px 12px rgba(26, 54, 93, 0.15)'
        }}>
          <IonIcon 
            icon={iconName} 
            style={{ 
              fontSize: '24px', 
              color: '#FFFFFF' 
            }} 
          />
        </div>
        <h2 style={{ margin: '0', fontSize: '26px', fontWeight: '800', color: '#0F172A', letterSpacing: '-0.02em' }}>
          {value}
        </h2>
        <p style={{ margin: '4px 0 0 0', fontSize: '13px', fontWeight: '600', color: '#64748B' }}>
          {title}
        </p>
        {subtitle && (
          <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#94A3B8', fontWeight: '500' }}>
            {subtitle}
          </p>
        )}
      </IonCardContent>
    </IonCard>
  );
}