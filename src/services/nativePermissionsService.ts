import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { Camera } from '@capacitor/camera';
import { PushNotifications } from '@capacitor/push-notifications';
import { BluetoothLowEnergy } from '@capgo/capacitor-bluetooth-low-energy';

export interface AppPermissionsStatus {
  location: boolean;
  camera: boolean;
  bluetooth: boolean;
  notifications: boolean;
}

class NativePermissionsService {
  private initialized = false;

  public initBLEShim() {
    if (this.initialized) return;
    if (Capacitor.isNativePlatform()) {
      try {
        BluetoothLowEnergy.shimWebBluetooth();
        BluetoothLowEnergy.initialize({ mode: 'central' }).catch((err) => {
          console.warn('BLE initialization notice:', err);
        });
      } catch (err) {
        console.warn('Failed to shim Web Bluetooth:', err);
      }
    }
    this.initialized = true;
  }

  public async requestAllPermissions(): Promise<AppPermissionsStatus> {
    const status: AppPermissionsStatus = {
      location: true,
      camera: true,
      bluetooth: true,
      notifications: true,
    };

    if (!Capacitor.isNativePlatform()) {
      return status;
    }

    this.initBLEShim();

    // 1. Location Permissions
    try {
      const geo = await Geolocation.requestPermissions();
      status.location = geo.location === 'granted';
    } catch (e) {
      console.warn('Location permission request notice:', e);
      status.location = false;
    }

    // 2. Camera Permissions
    try {
      const cam = await Camera.requestPermissions({ permissions: ['camera', 'photos'] });
      status.camera = cam.camera === 'granted' || cam.photos === 'granted';
    } catch (e) {
      console.warn('Camera permission request notice:', e);
      status.camera = false;
    }

    // 3. Bluetooth / Nearby Devices Permissions
    try {
      const ble = await BluetoothLowEnergy.requestPermissions();
      status.bluetooth = ble.bluetooth === 'granted';
    } catch (e) {
      console.warn('BLE permission request notice:', e);
      status.bluetooth = false;
    }

    // 4. Push Notifications Permissions
    try {
      const push = await PushNotifications.requestPermissions();
      status.notifications = push.receive === 'granted';
    } catch (e) {
      console.warn('Notification permission request notice:', e);
      status.notifications = false;
    }

    return status;
  }

  public async openSettings(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      try {
        await BluetoothLowEnergy.openAppSettings();
      } catch {
        // Fallback
      }
    }
  }
}

export const nativePermissionsService = new NativePermissionsService();
export default nativePermissionsService;
