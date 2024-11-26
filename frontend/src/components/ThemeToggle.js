// ThemeToggle.js
import React from 'react';
import './ThemeToggle.css';
function ThemeToggle({ theme, setTheme }) {
 const toggleTheme = () => {
 setTheme(theme === 'light' ? 'dark' : 'light');
 };
 return (
 <div className="theme-toggle">
 <button onClick={toggleTheme}>
 {theme === 'light' ? 'Switch to Dark Theme' : 'Switch to Light Theme'}
 </button>
 </div>
 );
}
export default ThemeToggle;