import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import { ToastProvider } from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import Dashboard from './pages/Dashboard';
import ImpactFeed from './pages/ImpactFeed';
import PolicyMap from './pages/PolicyMap';
import RemediationTracker from './pages/RemediationTracker';
import PublicationDetail from './pages/PublicationDetail';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider>
          <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
            <Navbar />
            <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
              <Routes>
                <Route path="/" element={
                  <ErrorBoundary label="Dashboard">
                    <Dashboard />
                  </ErrorBoundary>
                } />
                <Route path="/feed" element={
                  <ErrorBoundary label="Impact Feed">
                    <ImpactFeed />
                  </ErrorBoundary>
                } />
                <Route path="/publications/:id" element={
                  <ErrorBoundary label="Publication Detail">
                    <PublicationDetail />
                  </ErrorBoundary>
                } />
                <Route path="/policies" element={
                  <ErrorBoundary label="Policy Map">
                    <PolicyMap />
                  </ErrorBoundary>
                } />
                <Route path="/tasks" element={
                  <ErrorBoundary label="Remediation Tracker">
                    <RemediationTracker />
                  </ErrorBoundary>
                } />
              </Routes>
            </main>
          </div>
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
