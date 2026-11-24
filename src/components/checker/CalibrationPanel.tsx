import React, { useState } from 'react';
import { IonButton, IonIcon, IonInput } from '@ionic/react';
import { sendOutline, helpCircleOutline, refreshOutline, flaskOutline, alertCircleOutline } from 'ionicons/icons';

interface Props {
  isConnected: boolean;
  onSendCommand: (cmd: string) => Promise<boolean>;
  outputLines: string[];
  sectionRef?: React.RefObject<HTMLDivElement>;
}

export const CalibrationPanel: React.FC<Props> = ({ isConnected, onSendCommand, outputLines, sectionRef }) => {
  const [valA, setValA] = useState<string>('40.0');
  const [valB, setValB] = useState<string>('-2.5');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showForceConfirm, setShowForceConfirm] = useState<boolean>(false);

  const handleSendCurve = async () => {
    const a = Number(valA.trim());
    const b = Number(valB.trim());
    if (!valA.trim() || !valB.trim() || !Number.isFinite(a) || !Number.isFinite(b)) {
      setValidationError('Both A and B must be valid finite numbers.');
      return;
    }
    if (a <= 0) {
      setValidationError('Invalid curve: A must be > 0.');
      return;
    }
    if (b >= 0) {
      setValidationError('Invalid curve: B must be < 0.');
      return;
    }
    setValidationError(null);
    await onSendCommand(`curve ${a} ${b}`);
  };

  return (
    <div ref={sectionRef} style={{ marginTop: '12px', border: '1px solid #E2E8F0', borderRadius: '14px', background: '#FFFFFF', padding: '14px' }}>
      <h4 style={{ margin: '0 0 10px 0', fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>Calibration & Sensor Commands</h4>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Curve A (&gt; 0)</label>
          <IonInput
            type="number"
            step="any"
            value={valA}
            onIonInput={(e) => { setValA(e.detail.value ?? ''); setValidationError(null); }}
            style={{ border: '1px solid #CBD5E1', borderRadius: '8px', '--padding-start': '10px', '--padding-end': '10px', fontSize: '14px', fontFamily: 'monospace' }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Curve B (&lt; 0)</label>
          <IonInput
            type="number"
            step="any"
            value={valB}
            onIonInput={(e) => { setValB(e.detail.value ?? ''); setValidationError(null); }}
            style={{ border: '1px solid #CBD5E1', borderRadius: '8px', '--padding-start': '10px', '--padding-end': '10px', fontSize: '14px', fontFamily: 'monospace' }}
          />
        </div>
      </div>

      {validationError && (
        <div style={{ marginBottom: '10px', padding: '8px 10px', borderRadius: '8px', background: '#FEF2F2', color: '#991B1B', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <IonIcon icon={alertCircleOutline} style={{ flexShrink: 0 }} />
          <span>{validationError}</span>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        <IonButton size="small" color="primary" disabled={!isConnected} onClick={handleSendCurve} style={{ flex: '1 1 130px', margin: 0 }}>
          <IonIcon icon={sendOutline} slot="start" /> Send Curve
        </IonButton>
        <IonButton size="small" fill="outline" color="primary" disabled={!isConnected} onClick={() => onSendCommand('curve?')} style={{ flex: '1 1 150px', margin: 0 }}>
          <IonIcon icon={helpCircleOutline} slot="start" /> Show Current Curve
        </IonButton>
        <IonButton size="small" fill="outline" color="warning" disabled={!isConnected} onClick={() => onSendCommand('x')} style={{ flex: '1 1 160px', margin: 0 }}>
          <IonIcon icon={refreshOutline} slot="start" /> Revert to Lab Defaults
        </IonButton>
        <IonButton size="small" fill="outline" color="secondary" disabled={!isConnected} onClick={() => { onSendCommand('c'); setShowForceConfirm(true); }} style={{ flex: '1 1 130px', margin: 0 }}>
          <IonIcon icon={flaskOutline} slot="start" /> Calibrate R0
        </IonButton>
      </div>

      {showForceConfirm && isConnected && (
        <div style={{ marginTop: '8px', padding: '8px 10px', borderRadius: '8px', background: '#FFFBEB', border: '1px solid #FDE68A', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '12px', color: '#92400E' }}>
          <span>Force R0 calibration now (bypass warmup check)?</span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <IonButton size="small" color="warning" onClick={() => { onSendCommand('c force'); setShowForceConfirm(false); }} style={{ margin: 0, height: '26px', fontSize: '11px' }}>Send c force</IonButton>
            <IonButton size="small" fill="clear" color="medium" onClick={() => setShowForceConfirm(false)} style={{ margin: 0, height: '26px', fontSize: '11px' }}>Cancel</IonButton>
          </div>
        </div>
      )}

      <div style={{ marginTop: '10px', padding: '10px 12px', background: '#0F172A', color: '#E2E8F0', borderRadius: '8px', fontFamily: 'monospace', fontSize: '11px', lineHeight: 1.45, maxHeight: '160px', overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {outputLines.length > 0 ? outputLines.join('\n') : 'Command output will appear here…'}
      </div>
    </div>
  );
};

export default CalibrationPanel;
