import { Routes, Route, Navigate } from 'react-router-dom';

import Login from './pages/Login';
import Register from './pages/Register';

import UserDashboard from './pages/user/UserDashboard';
import UserSites from './pages/user/UserSites';
import UserInspectionSites from './pages/user/UserInspectionSites';
import InspectionSiteDetail from './pages/user/InspectionSiteDetail';
import UserSchedules from './pages/user/UserSchedules';
import ScheduleDetail from './pages/user/ScheduleDetail';
import UserDevices from './pages/user/UserDevices';
import AddTagPage from './pages/user/AddTagPage';
import UserMap from './pages/user/UserMap';
import UserBLESensor from './pages/user/UserBLESensor';

import ProtectedRoute from './components/ProtectedRoute';
import UserLayout from './layouts/UserLayout';

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <UserLayout>
              <UserDashboard />
            </UserLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/map"
        element={
          <ProtectedRoute>
            <UserLayout>
              <UserMap />
            </UserLayout>
          </ProtectedRoute>
        }
      />
      <Route path="/spatial-map" element={<Navigate to="/map" replace />} />
      <Route path="/area-mapping" element={<Navigate to="/map" replace />} />

      <Route
        path="/ble-sensor"
        element={
          <ProtectedRoute>
            <UserLayout>
              <UserBLESensor />
            </UserLayout>
          </ProtectedRoute>
        }
      />

      <Route path="/my-piggeries" element={<Navigate to="/inspection-sites" replace />} />
      <Route path="/monitoring-sites" element={<Navigate to="/inspection-sites" replace />} />
      <Route
        path="/inspection-sites"
        element={
          <ProtectedRoute>
            <UserLayout>
              <UserInspectionSites />
            </UserLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/inspection-sites/:id"
        element={
          <ProtectedRoute>
            <UserLayout>
              <InspectionSiteDetail />
            </UserLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/schedules"
        element={
          <ProtectedRoute>
            <UserLayout>
              <UserSchedules />
            </UserLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/schedules/:id"
        element={
          <ProtectedRoute>
            <UserLayout>
              <ScheduleDetail />
            </UserLayout>
          </ProtectedRoute>
        }
      />

      <Route path="/my-devices" element={<Navigate to="/devices" replace />} />
      <Route
        path="/devices"
        element={
          <ProtectedRoute>
            <UserLayout>
              <UserDevices />
            </UserLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/schedules/:scheduleId/add-tag"
        element={
          <ProtectedRoute>
            <UserLayout>
              <AddTagPage />
            </UserLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/add-tag"
        element={
          <ProtectedRoute>
            <UserLayout>
              <AddTagPage />
            </UserLayout>
          </ProtectedRoute>
        }
      />

      <Route path="/my-sensor-data" element={<Navigate to="/schedules" replace />} />
      <Route path="/sensor-data" element={<Navigate to="/schedules" replace />} />
      <Route path="/my-alerts" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}