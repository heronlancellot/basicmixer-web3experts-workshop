import { Toaster } from 'react-hot-toast'
import { Header, Hero, Footer, FAQList, About } from '@/components'
import { BrowserRouter, Routes, Route } from 'react-router-dom';

function App() {

  return (
    <div className="min-h-screen h-screen flex flex-col">
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#111111',
            color: '#888888',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '16px',
            fontFamily: "Inter, sans-serif",
          },
          success: {
            iconTheme: {
              primary: '#ffffff',
              secondary: '#111111',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#141414',
            },
          },
        }}
      />

      <Header />
      <main className="flex-1">
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Hero />} />
            <Route path="/faq" element={<FAQList />} />
            <Route path="/about" element={<About />} />
          </Routes>
        </BrowserRouter >
      </main>
      <Footer />
    </div>
  )
}

export default App
