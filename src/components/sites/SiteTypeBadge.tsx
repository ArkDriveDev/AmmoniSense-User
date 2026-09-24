import React from 'react';
import { IonBadge, IonIcon } from '@ionic/react';
import { getSiteTypeMeta } from '../../utils/siteUtils';

interface SiteTypeBadgeProps {
  siteType?: string;
  style?: React.CSSProperties;
  className?: string;
  iconOnly?: boolean;
}

export const SiteTypeBadge: React.FC<SiteTypeBadgeProps> = ({
  siteType,
  style,
  className,
  iconOnly = false,
}) => {
  const meta = getSiteTypeMeta(siteType);

  return (
    <IonBadge
      className={className}
      style={{
        background: meta.badgeBg,
        color: meta.badgeColor,
        border: `1px solid ${meta.borderColor}`,
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: 700,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 8px',
        verticalAlign: 'middle',
        ...style,
      }}
    >
      <IonIcon icon={meta.icon} style={{ fontSize: '13px' }} />
      {!iconOnly && <span>{meta.label}</span>}
    </IonBadge>
  );
};

export default SiteTypeBadge;
