import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppBootstrap } from './components/AppBootstrap'
import { AdminPage } from './routes/AdminPage'
import { PlayerPage } from './routes/PlayerPage'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <AppBootstrap>
        <Routes>
          <Route path="/" element={<AdminPage />} />
          <Route path="/player" element={<PlayerPage />} />
          <Route path="*" element={<Navigate replace to="/" />} />
        </Routes>
      </AppBootstrap>
    </BrowserRouter>
  )
}

export default App
