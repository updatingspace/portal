import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './components/MainLayout';
import { HomePage } from './pages/HomePage';
import { NominationPage } from './pages/NominationPage';
import { ProfilePage } from './pages/ProfilePage';
import { VotingPage } from './pages/VotingPage';
import { AdminPage } from './pages/AdminPage';
import { NotFoundPage } from './pages/NotFoundPage';

const App: React.FC = () => {
  return (
    <MainLayout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/votings/:votingId" element={<VotingPage />} />
        <Route path="/nominations" element={<Navigate to="/" replace />} />
        <Route path="/nominations/:id" element={<NominationPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </MainLayout>
  );
};

export default App;
