import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, requires2FA } = useAuth();
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('LOGIN CLICKED', formData);
    setError('');
    setIsLoading(true);

    try {
      console.log('CALLING LOGIN...');
      const result = await login(formData);
      console.log('LOGIN RESULT:', result);
      console.log('LOGIN DONE, requires2FA:', requires2FA);
      
      if (!requires2FA) {
        console.log('NAVIGATING TO DASHBOARD');
        navigate('/dashboard');
      }
    } catch (err: any) {
      console.error('LOGIN ERROR:', err);
      setError(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <h2 className="text-center text-3xl font-extrabold">Sign in to Kollabor8</h2>
        <p className="text-center text-sm">
          Or <Link to="/register" className="text-indigo-600">create a new account</Link>
        </p>

        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          {error && <div className="bg-red-50 p-4 rounded"><div className="text-sm text-red-700">{error}</div></div>}

          <div>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full px-3 py-2 border rounded-t-md"
              placeholder="Email address"
              value={formData.email}
              onChange={handleInputChange}
            />
          </div>
          <div>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="w-full px-3 py-2 border rounded-b-md"
              placeholder="Password"
              value={formData.password}
              onChange={handleInputChange}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {isLoading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
