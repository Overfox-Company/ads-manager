import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppBootstrap } from './components/AppBootstrap'
import { AdminPage } from './routes/AdminPage'
import { PlayerPage } from './routes/PlayerPage'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppBootstrap><AdminPage /></AppBootstrap>} />
        <Route path="/player" element={<PlayerPage />} />
        <Route path="/player/:screenId" element={<PlayerPage />} />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
