import React, { useState } from 'react';
import { IonButton, IonIcon } from '@ionic/react';
import { chevronDownOutline, chevronUpOutline, terminalOutline } from 'ionicons/icons';

interface Props {
  rawLine?: string;
}

export const RawStreamDisclosure: React.FC<Props> = ({ rawLine }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div style={{ marginTop: '8px', border: '1px solid #E2E8F0', borderRadius: '12px', background: '#FFFFFF', padding: '8px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <IonIcon icon={terminalOutline} />
          Raw Stream Line
        </span>
        <IonButton
          fill="clear"
          size="small"
          onClick={() => setIsOpen(!isOpen)}
          style={{ '--color': '#1D5D9B', fontSize: '12px', textTransform: 'none', margin: 0 }}
        >
          {isOpen ? 'Hide raw stream' : 'Show raw stream'}
          <IonIcon icon={isOpen ? chevronUpOutline : chevronDownOutline} slot="end" />
        </IonButton>
      </div>

      {isOpen && (
        <div style={{ marginTop: '8px', padding: '10px 12px', background: '#0F172A', color: '#38BDF8', borderRadius: '8px', fontFamily: 'monospace', fontSize: '11px', lineHeight: 1.4, wordBreak: 'break-all' }}>
          {rawLine || 'Waiting for incoming serial line…'}
        </div>
      )}
    </div>
  );
};

export default RawStreamDisclosure;
