
import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { authApi, resetDatabase } from '../services/apiService';
import { useLanguage } from '../context/LanguageContext';
import { User, Role } from '../types'; // Import Role type
import { AuthService } from '../services/auth.service'; // NEW: Import AuthService

type LoginApiFunction = (credentials: { username: string; password: string; }) => Promise<{ user: User; role: Role; token: string }>;

const LoginPage: React.FC = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [failCount, setFailCount] = useState(0);
    const { login } = useAuth(); // Use the login function from AuthContext
    const { language, t } = useLanguage();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (!username || !password) {
            setError(t('login.fillFields'));
            setLoading(false);
            return;
        }

        try {
            // NEW: Use AuthService.login which handles API call and token storage
            await login(username, password, rememberMe); // The login function from useAuth now handles everything
        } catch (err: any) {
            setError(err.message || t('login.invalidCredentials'));
            setFailCount(p => p + 1);
        } finally {
            setLoading(false);
        }
    };

    const handleSystemReset = async () => {
        if (window.confirm("Warning: This will wipe all local data and restore the default admin account (admin/admin). Continue?")) {
            await resetDatabase();
        }
    };

    const inputClass = "bg-black/10 border border-white/20 text-white text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 placeholder-gray-400 transition-all";

    return (
        <div className="relative min-h-screen flex flex-col items-center justify-center p-4 bg-cover bg-center" style={{ backgroundImage: "url('https://d1wo7kaelp5eck.cloudfront.net/sunrise-resorts.com-1611976553/cms/cache/v2/65c24abee658d.jpg/1920x1080/fit/80/fbfe860fe26ef601e58afd7a34816316.jpg')" }}>
            <div className="absolute inset-0 bg-black bg-opacity-30"></div>
            
            <div className="relative z-10 text-center mb-10 flex flex-col items-center animate-fade-in-up">
                <svg width="80" height="80" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-lg">
                    <path d="M50 10 L85 40 H15 Z" className="fill-primary-500" />
                    <path d="M40 90 L25 40 H75 L60 90 Z" className="fill-amber-400" />
                </svg>
                <h1 className="text-5xl font-bold font-sans text-white tracking-wider mt-4" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>Sunrise</h1>
                <p className="text-lg font-sans text-primary-200 tracking-widest mt-2 uppercase" style={{ textShadow: '1px 1px 3px rgba(0,0,0,0.5)' }}>Staff Housing</p>
            </div>

            <div className="relative z-10 w-full max-w-sm bg-black/20 backdrop-blur-lg border border-white/20 rounded-lg shadow-2xl overflow-hidden animate-fade-in-up">
                <div className="p-8">
                    <h2 className="text-2xl font-bold text-white text-center mb-8">{t('login.title')}</h2>
                    <form className="space-y-6" onSubmit={handleSubmit}>
                        <div>
                            <label className="block mb-2 text-sm font-medium text-gray-300">{t('login.username')}</label>
                            <input type="text" className={inputClass} value={username} onChange={(e) => setUsername(e.target.value)} required />
                        </div>
                        <div>
                            <label className="block mb-2 text-sm font-medium text-gray-300">{t('login.password')}</label>
                            <div className="relative">
                                <input type={showPassword ? "text" : "password"} className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} required />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-3 flex items-center text-white/50">
                                    <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                </button>
                            </div>
                        </div>
                        
                        {error && (
                            <div className="space-y-2">
                                <p className="text-sm text-red-400 text-center animate-pulse font-bold">{error}</p>
                                {failCount >= 2 && (
                                    <button 
                                        type="button" 
                                        onClick={handleSystemReset}
                                        className="w-full text-[10px] uppercase font-black tracking-widest text-amber-400 hover:text-amber-300 transition-colors"
                                    >
                                        Forgot admin password? Reset System
                                    </button>
                                )}
                            </div>
                        )}

                        <button type="submit" className="w-full text-white bg-primary-600 hover:bg-primary-700 font-medium rounded-lg text-sm px-5 py-3 transition-all duration-300 shadow-lg active:scale-[0.98]" disabled={loading}>
                            {loading ? <><i className="fas fa-spinner fa-spin mr-2"></i>Verifying Identity...</> : t('login.loginButton')}
                        </button>
                    </form>
                </div>
            </div>
            
            <footer className="absolute bottom-4 text-center w-full z-10"><p className="text-sm text-white/70">Implemented by: Mohamed Tarek</p></footer>
        </div>
    );
};

export default LoginPage;
