import { Routes, Route, Navigate } from 'react-router-dom';

import Login from './pages/Login';
import Register from './pages/Register';

import UserDashboard from './pages/user/UserDashboard';
import UserSites from './pages/user/UserSites';
import UserDevices from './pages/user/UserDevices';
import UserSensorData from './pages/user/UserSensorData';
import UserMap from './pages/user/UserMap';
import AreaMapping from './pages/user/AreaMapping';
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