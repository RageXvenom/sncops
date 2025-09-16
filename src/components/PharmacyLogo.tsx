import React from 'react';

const PharmacyLogo: React.FC = () => {
  return (
    <div className="flex items-center justify-center mb-8 pharmacy-logo">
      <div className="relative">
        {/* Main pharmacy symbol */}
        <div className="w-32 h-32 relative soft-glow rounded-full bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 flex items-center justify-center">
          {/* Cross symbol */}
          <div className="relative">
            {/* Vertical bar */}
            <div className="w-4 h-16 bg-gradient-to-b from-blue-600 to-blue-700 rounded-full absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2"></div>
            {/* Horizontal bar */}
            <div className="w-16 h-4 bg-gradient-to-r from-blue-600 to-blue-700 rounded-full absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2"></div>
          </div>
          
          {/* Decorative elements */}
          <div className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-br from-green-400 to-green-500 rounded-full gentle-float"></div>
          <div className="absolute -bottom-2 -left-2 w-4 h-4 bg-gradient-to-br from-teal-400 to-teal-500 rounded-full gentle-float" style={{ animationDelay: '2s' }}></div>
          <div className="absolute top-2 -left-3 w-3 h-3 bg-gradient-to-br from-blue-400 to-blue-500 rounded-full gentle-float" style={{ animationDelay: '4s' }}></div>
        </div>
        
        {/* Orbiting particles */}
        <div className="absolute inset-0 animate-spin" style={{ animationDuration: '20s' }}>
          <div className="absolute top-0 left-1/2 w-2 h-2 bg-blue-400 rounded-full transform -translate-x-1/2 soft-particles"></div>
        </div>
        <div className="absolute inset-0 animate-spin" style={{ animationDuration: '25s', animationDirection: 'reverse' }}>
          <div className="absolute bottom-0 left-1/2 w-2 h-2 bg-green-400 rounded-full transform -translate-x-1/2 soft-particles" style={{ animationDelay: '1s' }}></div>
        </div>
        <div className="absolute inset-0 animate-spin" style={{ animationDuration: '30s' }}>
          <div className="absolute left-0 top-1/2 w-2 h-2 bg-teal-400 rounded-full transform -translate-y-1/2 soft-particles" style={{ animationDelay: '2s' }}></div>
        </div>
        <div className="absolute inset-0 animate-spin" style={{ animationDuration: '35s', animationDirection: 'reverse' }}>
          <div className="absolute right-0 top-1/2 w-2 h-2 bg-blue-500 rounded-full transform -translate-y-1/2 soft-particles" style={{ animationDelay: '3s' }}></div>
        </div>
      </div>
    </div>
  );
};

export default PharmacyLogo;