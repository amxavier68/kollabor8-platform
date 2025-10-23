import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log('LOGIN FORM SUBMITTED');
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    console.log('Email:', email);
    
    try {
      console.log('Calling login...');
      await login({ email, password });
      console.log('Login successful, navigating...');
      navigate('/dashboard');
    } catch (error) {
      console.error('Login error:', error);
      alert('Login failed: ' + (error as any).message);
    }
  };

  return (
    <div className="flex h-screen">
      <div className="hidden md:flex w-1/2 bg-gradient-to-br from-indigo-500 to-blue-600 text-white flex-col justify-center items-center p-10">
        <h1 className="text-4xl font-bold mb-2">Kollabor8</h1>
        <p className="text-lg opacity-80">Elevate your online visibility.</p>
      </div>

      <div className="w-full md:w-1/2 flex flex-col justify-center items-center p-10 bg-white">
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
          <h2 className="text-2xl font-semibold text-center">Welcome Back</h2>
          <input
            name="email"
            type="email"
            placeholder="Email"
            required
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
          <input
            name="password"
            type="password"
            placeholder="Password"
            required
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition"
          >
            Sign In
          </button>
          <p className="text-center text-sm">
            Don't have an account?{' '}
            <a href="/register" className="text-indigo-600 hover:underline">
              Sign up
            </a>
          </p>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
