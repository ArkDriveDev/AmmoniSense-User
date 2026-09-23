import React, { useEffect, useState } from 'react';
import { IonPage, IonContent } from '@ionic/react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import AddTagModal from '../../components/inspection/AddTagModal';
import { fetchScheduleById } from '../../services/scheduleService';

export default function AddTagPage() {
  const { scheduleId } = useParams<{ scheduleId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const activeSchedId = scheduleId || searchParams.get('scheduleId') || '';
  const [siteId, setSiteId] = useState<string | number>(searchParams.get('siteId') || '');

  useEffect(() => {
    if (activeSchedId && !siteId) {
      fetchScheduleById(activeSchedId).then((sched) => {
        if (sched?.inspection_site_id) setSiteId(sched.inspection_site_id);
      });
    }
  }, [activeSchedId, siteId]);

  return (
    <IonPage>
      <IonContent>
        <AddTagModal
          isOpen={true}
          onClose={() => navigate(activeSchedId ? `/schedules/${activeSchedId}` : '/schedules')}
          scheduleId={activeSchedId}
          siteId={siteId}
          onCreated={() => navigate(activeSchedId ? `/schedules/${activeSchedId}` : '/schedules')}
        />
      </IonContent>
    </IonPage>
  );
}
