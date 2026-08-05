import React, { useEffect, useState } from 'react';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonItem,
  IonLabel,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonSpinner,
  IonToast,
  IonIcon,
  IonRow,
  IonCol,
  IonGrid
} from '@ionic/react';
import { locateOutline, addCircleOutline } from 'ionicons/icons';
import { Geolocation } from '@capacitor/geolocation';
import { supabase } from '../../services/supabase';

export interface CreateSiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSiteCreated?: (newSite: any) => void;
}

export const CreateSiteModal: React.FC<CreateSiteModalProps> = ({ isOpen, onClose, onSiteCreated }) => {
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);

  const [form, setForm] = useState({
    site_code: `SITE-${Math.floor(1000 + Math.random() * 9000)}`,
    site_name: '',
    site_type: 'Piggery',
    address: '',
    area_size_hectares: '1.0',
    current_latitude: 14.5995,
    current_longitude: 120.9842,
    current_grid_cell_id: 'A1',
    notes: '',
  });

  const [toastMsg, setToastMsg] = useState('');
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Auto-fetch GPS when modal opens
      fetchCurrentGps();
    }
  }, [isOpen]);

  const fetchCurrentGps = async () => {
    setLocating(true);
    try {
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
      setForm(prev => ({
        ...prev,
        current_latitude: pos.coords.latitude,
        current_longitude: pos.coords.longitude,
      }));
    } catch (err) {
      console.warn('GPS location fetch error:', err);
    } finally {
      setLocating(false);
    }
  };

  const handleCreateSite = async () => {
    if (!form.site_name) {
      setToastMsg('Please enter a site name');
      setShowToast(true);
      return;
    }

    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;

      if (!user) throw new Error('User authentication required');

      // 1. Get or create site_owner for current inspector
      const { data: owners } = await supabase
        .from('site_owners')
        .select('id')
        .eq('created_by', user.id);

      let ownerId = owners && owners.length > 0 ? owners[0].id : null;

      if (!ownerId) {
        const { data: newOwner, error: ownerErr } = await supabase
          .from('site_owners')
          .insert([
            {
              owner_name: user.user_metadata?.full_name || user.email || 'Inspector Owner',
              email: user.email || `inspector_${user.id.slice(0, 6)}@menro.gov.ph`,
              created_by: user.id,
            },
          ])
          .select('id')
          .single();

        if (ownerErr || !newOwner) {
          throw new Error('Failed to associate site owner: ' + (ownerErr?.message || 'Error'));
        }
        ownerId = newOwner.id;
      }

      // 2. Insert into monitoring_sites
      const sitePayload = {
        site_code: form.site_code,
        site_name: form.site_name,
        site_type: form.site_type,
        owner_id: ownerId,
        current_latitude: form.current_latitude,
        current_longitude: form.current_longitude,
        current_grid_cell_id: form.current_grid_cell_id,
        address: form.address || form.site_name,
        area_size_hectares: parseFloat(form.area_size_hectares) || 1.0,
        notes: form.notes || null,
        created_by: user.id,
        updated_by: user.id,
        is_active: true,
      };

      const { data: createdSite, error: siteErr } = await supabase
        .from('monitoring_sites')
        .insert([sitePayload])
        .select('*')
        .single();

      if (siteErr) {
        throw new Error('Failed to create site: ' + siteErr.message);
      }

      setToastMsg(`Monitoring Site "${createdSite.site_name}" created successfully!`);
      setShowToast(true);

      if (onSiteCreated) onSiteCreated(createdSite);
      onClose();
    } catch (err: any) {
      console.error('Error creating site:', err);
      setToastMsg(err.message || 'Error creating monitoring site');
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose}>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Create Monitoring Site</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onClose}>Cancel</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <IonGrid style={{ maxWidth: '600px', margin: '0 auto' }}>
          <IonItem lines="full">
            <IonLabel position="stacked">Site Code</IonLabel>
            <IonInput
              value={form.site_code}
              onIonChange={e => setForm({ ...form, site_code: e.detail.value! })}
              placeholder="e.g. SITE-2026-001"
            />
          </IonItem>

          <IonItem lines="full">
            <IonLabel position="stacked">Site Name *</IonLabel>
            <IonInput
              value={form.site_name}
              onIonChange={e => setForm({ ...form, site_name: e.detail.value! })}
              placeholder="e.g. Silang Livestock Farm - Site A"
            />
          </IonItem>

          <IonItem lines="full">
            <IonLabel position="stacked">Site Category / Type</IonLabel>
            <IonSelect
              value={form.site_type}
              onIonChange={e => setForm({ ...form, site_type: e.detail.value! })}
            >
              <IonSelectOption value="Piggery">Piggery Farm</IonSelectOption>
              <IonSelectOption value="Poultry">Poultry Farm</IonSelectOption>
              <IonSelectOption value="Agricultural">Agricultural Zone</IonSelectOption>
              <IonSelectOption value="Industrial">Industrial Facility</IonSelectOption>
              <IonSelectOption value="River/Waterway">River / Waterway</IonSelectOption>
            </IonSelect>
          </IonItem>

          <IonItem lines="full">
            <IonLabel position="stacked">Address / Location Description</IonLabel>
            <IonInput
              value={form.address}
              onIonChange={e => setForm({ ...form, address: e.detail.value! })}
              placeholder="e.g. Brgy. San Pedro, Silang, Cavite"
            />
          </IonItem>

          <IonRow>
            <IonCol size="6">
              <IonItem lines="full">
                <IonLabel position="stacked">Area Size (Hectares)</IonLabel>
                <IonInput
                  type="number"
                  value={form.area_size_hectares}
                  onIonChange={e => setForm({ ...form, area_size_hectares: e.detail.value! })}
                />
              </IonItem>
            </IonCol>
            <IonCol size="6">
              <IonItem lines="full">
                <IonLabel position="stacked">Initial Grid Cell</IonLabel>
                <IonInput
                  value={form.current_grid_cell_id}
                  onIonChange={e => setForm({ ...form, current_grid_cell_id: e.detail.value! })}
                />
              </IonItem>
            </IonCol>
          </IonRow>

          {/* GPS Coordinates Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px', marginBottom: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b' }}>
              GPS Location Coordinates
            </span>
            <IonButton fill="clear" size="small" onClick={fetchCurrentGps} disabled={locating}>
              <IonIcon icon={locateOutline} slot="start" />
              {locating ? 'Acquiring GPS...' : 'Refetch GPS'}
            </IonButton>
          </div>

          <IonRow>
            <IonCol size="6">
              <IonItem lines="full">
                <IonLabel position="stacked">Latitude</IonLabel>
                <IonInput
                  type="number"
                  value={form.current_latitude}
                  onIonChange={e => setForm({ ...form, current_latitude: parseFloat(e.detail.value!) || 0 })}
                />
              </IonItem>
            </IonCol>
            <IonCol size="6">
              <IonItem lines="full">
                <IonLabel position="stacked">Longitude</IonLabel>
                <IonInput
                  type="number"
                  value={form.current_longitude}
                  onIonChange={e => setForm({ ...form, current_longitude: parseFloat(e.detail.value!) || 0 })}
                />
              </IonItem>
            </IonCol>
          </IonRow>

          <IonItem lines="full" style={{ marginTop: '12px' }}>
            <IonLabel position="stacked">Inspector Notes (Optional)</IonLabel>
            <IonTextarea
              rows={3}
              value={form.notes}
              onIonChange={e => setForm({ ...form, notes: e.detail.value! })}
              placeholder="e.g. Proximity to river stream: 50m. Inspection access via main gate."
            />
          </IonItem>

          <IonButton
            expand="block"
            color="primary"
            size="large"
            onClick={handleCreateSite}
            disabled={loading}
            style={{ marginTop: '24px', fontWeight: 'bold' }}
          >
            {loading ? (
              <>
                <IonSpinner name="crescent" />
                &nbsp;Creating Site...
              </>
            ) : (
              <>
                <IonIcon icon={addCircleOutline} slot="start" />
                Save & Register Monitoring Site
              </>
            )}
          </IonButton>
        </IonGrid>

        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMsg}
          duration={3500}
          position="bottom"
        />
      </IonContent>
    </IonModal>
  );
};

export default CreateSiteModal;
