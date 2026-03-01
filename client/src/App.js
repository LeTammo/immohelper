import './App.css';
import React, { useState } from 'react';
import Listings from './Listings';
import Login from './Login';

const App = () => {
  const [user, setUser] = useState(null);

  const handleLogin = (credentials) => {
    setUser(credentials);
  };

  return (
      <div className="App">
        {user ? (
            <Listings user={user} />
        ) : (
            <Login onLogin={handleLogin} />
        )}
      </div>
  );
}

export default App;
