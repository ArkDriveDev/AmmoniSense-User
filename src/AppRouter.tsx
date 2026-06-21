import { Routes, Route, Navigate } from 'react-router-dom';

import Login from './pages/Login';
import Register from './pages/Register';

import UserDashboard from './pages/user/UserDashboard';
import UserPiggeries from './pages/user/UserPiggeries';
import UserDevices from './pages/user/UserDevices';
import UserSensorData from './pages/user/UserSensorData';
import UserAlerts from './pages/user/UserAlerts';

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
        path="/my-piggeries"
        element={
          <ProtectedRoute>
            <UserLayout>
              <UserPiggeries />
            </UserLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/my-devices"
        element={
          <ProtectedRoute>
            <UserLayout>
              <UserDevices />
            </UserLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/my-sensor-data"
        element={
          <ProtectedRoute>
            <UserLayout>
              <UserSensorData />
            </UserLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/my-alerts"
        element={
          <ProtectedRoute>
            <UserLayout>
              <UserAlerts />
            </UserLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}