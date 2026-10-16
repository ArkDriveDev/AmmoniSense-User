import React, { useEffect, useState } from 'react';
import { IonProgressBar, IonText, IonIcon } from '@ionic/react';
import { timerOutline, shieldCheckmarkOutline } from 'ionicons/icons';

interface Props {
  isActive: boolean;
  onComplete: () => void;
  durationSeconds?: number;
}

export const SensorStabilization: React.FC<Props> = ({
  isActive,
  onComplete,
  durationSeconds = 20,
}) => {
  const [secondsLeft, setSecondsLeft] = useState<number>(durationSeconds);

  useEffect(() => {
    if (!isActive) {
      setSecondsLeft(durationSeconds);
      return;
    }

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, durationSeconds, onComplete]);

  const progress = Math.max(0, Math.min(1, (durationSeconds - secondsLeft) / durationSeconds));
  const isDone = secondsLeft === 0;

  return (
    <div style={{ padding: '14px', background: '#F8FAFC', borderRadius: '10px', marginTop: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <IonIcon icon={isDone ? shieldCheckmarkOutline : timerOutline} color={isDone ? 'success' : 'warning'} />
          {isDone ? 'Sensor Stabilized' : 'Stabilizing Sensor Chamber...'}
        </span>
        <IonText color={isDone ? 'success' : 'medium'} style={{ fontSize: '12px', fontWeight: 700 }}>
          {isDone ? 'READY' : `${secondsLeft}s`}
        </IonText>
      </div>
      <IonProgressBar value={progress} color={isDone ? 'success' : 'warning'} style={{ height: '8px', borderRadius: '4px' }} />
    </div>
  );
};

export default SensorStabilization;
