import { Routes, Route, Link } from 'react-router-dom';
import NuevoProyecto from './pages/NuevoProyecto.jsx';
import Login from './pages/Login.jsx';

export default function App() {
  return (
    <>
      <nav>
        <Link to="/">Nuevo Proyecto</Link>
        <Link to="/login">Login</Link>
      </nav>
      <main>
        <Routes>
          <Route path="/" element={<NuevoProyecto />} />
          <Route path="/login" element={<Login />} />
        </Routes>
      </main>
    </>
  );
}
