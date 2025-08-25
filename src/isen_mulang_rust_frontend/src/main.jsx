import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
// Import the main CSS file for the application.
// Vite needs this explicit import to include the CSS in the final bundle.
import './index.scss';

// The entry point for the React application.
// This file is responsible for rendering the main App component
// into the root div of the HTML document.

// Create a root for the React app on the DOM element with the ID 'root'.
// This is where all your React components will be rendered.
const root = ReactDOM.createRoot(document.getElementById('root'));

// Render the main App component inside the root.
// The <React.StrictMode> component helps with finding and highlighting potential problems in an application.
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

