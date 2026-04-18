import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import ImpactFeed from './pages/ImpactFeed';
import PolicyMap from './pages/PolicyMap';
import RemediationTracker from './pages/RemediationTracker';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
          <Navbar />
          <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
            <Routes>
              <Route path="/" element={<ImpactFeed />} />
              <Route path="/policies" element={<PolicyMap />} />
              <Route path="/tasks" element={<RemediationTracker />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
