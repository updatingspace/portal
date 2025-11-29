import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './components/MainLayout';
import { HomePage } from './pages/HomePage';
import { NominationPage } from './pages/NominationPage';
import { ProfilePage } from './pages/ProfilePage';
import { VotingPage } from './pages/VotingPage';

const App: React.FC = () => {
  return (
    <MainLayout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/votings/:votingId" element={<VotingPage />} />
        <Route path="/nominations" element={<Navigate to="/" replace />} />
        <Route path="/nominations/:id" element={<NominationPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </MainLayout>
  );
};

export default App;
