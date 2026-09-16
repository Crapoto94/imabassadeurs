import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Home from './pages/Home';
import Resources from './pages/Resources';
import ResourceDetail from './pages/ResourceDetail';
import Experiments from './pages/Experiments';
import ExperimentDetail from './pages/ExperimentDetail';
import Risks from './pages/Risks';
import RiskDetail from './pages/RiskDetail';
import Votes from './pages/Votes';
import VoteDetail from './pages/VoteDetail';
import Mapping from './pages/Mapping';
import Analytics from './pages/Analytics';
import Admin from './pages/Admin';
import Account from './pages/Account';
import RateDigest from './pages/RateDigest';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/digest/rate/:token" element={<RateDigest />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/" element={<Home />} />
        <Route path="/ressources" element={<Resources />} />
        <Route path="/ressources/:id" element={<ResourceDetail />} />
        <Route path="/experimentations" element={<Experiments />} />
        <Route path="/experimentations/:id" element={<ExperimentDetail />} />
        <Route path="/risques" element={<Risks />} />
        <Route path="/risques/:id" element={<RiskDetail />} />
        <Route path="/votes" element={<Votes />} />
        <Route path="/votes/:id" element={<VoteDetail />} />
        <Route path="/cartographie" element={<Mapping />} />
        <Route path="/analyse" element={<ProtectedRoute roles={['ianimateur']}><Analytics /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute roles={['admin']}><Admin /></ProtectedRoute>} />
        <Route path="/compte" element={<Account />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
