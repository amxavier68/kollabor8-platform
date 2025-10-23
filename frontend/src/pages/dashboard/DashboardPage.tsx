import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import MainLayout from '../../layouts/MainLayout';

const DashboardPage: React.FC = () => {
  const { user } = useAuth();

  return (
    <MainLayout>
      <div className="space-y-4 sm:space-y-6 p-4 sm:p-0">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg shadow-lg p-6 sm:p-8 text-white">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Welcome back, {user?.name}!</h1>
          <p className="text-sm sm:text-base text-indigo-100">Here's what's happening with your account today.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Active Licenses */}
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 border-l-4 border-indigo-500 hover:shadow-lg transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-600 uppercase">Active Licenses</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-2">0</p>
              </div>
              <div className="p-2 sm:p-3 bg-indigo-100 rounded-full">
                <svg className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Plugins Installed */}
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 border-l-4 border-purple-500 hover:shadow-lg transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-600 uppercase">Plugins Installed</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-2">0</p>
              </div>
              <div className="p-2 sm:p-3 bg-purple-100 rounded-full">
                <svg className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
            </div>
          </div>

          {/* Account Type */}
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 border-l-4 border-green-500 hover:shadow-lg transition sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-600 uppercase">Account Type</p>
                <p className="text-lg sm:text-xl font-semibold text-gray-900 mt-2 capitalize">{user?.role || 'user'}</p>
              </div>
              <div className="p-2 sm:p-3 bg-green-100 rounded-full">
                <svg className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">Recent Activity</h2>
            <button className="text-indigo-600 hover:text-indigo-700 text-xs sm:text-sm font-medium">
              View All
            </button>
          </div>
          <div className="text-center py-8 sm:py-12">
            <svg className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="mt-2 text-sm sm:text-base text-gray-600">No recent activity</p>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">Your activity will appear here</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <button className="w-full text-left px-3 sm:px-4 py-2 sm:py-3 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition">
                <span className="text-sm sm:text-base text-indigo-700 font-medium">+ Create New License</span>
              </button>
              <button className="w-full text-left px-3 sm:px-4 py-2 sm:py-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition">
                <span className="text-sm sm:text-base text-purple-700 font-medium">+ Upload Plugin</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Account Info</h3>
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                <span className="text-sm text-gray-600">Email:</span>
                <span className="text-sm font-medium text-gray-900 truncate">{user?.email}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                <span className="text-sm text-gray-600">Status:</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 self-start">
                  Active
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                <span className="text-sm text-gray-600">2FA:</span>
                <span className="text-sm text-gray-900 font-medium">
                  {user?.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default DashboardPage;
