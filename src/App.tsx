import { Route, Routes } from 'react-router-dom';
import { NavBar } from './components/NavBar';
import { CreateVideoPage } from './pages/CreateVideoPage';
import { ImagesPage } from './pages/ImagesPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { VideosPage } from './pages/VideosPage';

export const App = () => {
    return (
        <div className="app">
            <NavBar />
            <main className="app__main">
                <Routes>
                    <Route path="/" element={<CreateVideoPage />} />
                    <Route path="/videos" element={<VideosPage />} />
                    <Route path="/images" element={<ImagesPage />} />
                    <Route path="*" element={<NotFoundPage />} />
                </Routes>
            </main>
        </div>
    );
};
