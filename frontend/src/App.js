// src/App.js
import React, { useState, useEffect } from 'react';
import SearchBar from './components/SearchBar';
import ResourceList from './components/ResourceList';
import ThemeToggle from './components/ThemeToggle';
import './styles/App.css';
function App() {
 const [theme, setTheme] = useState('light');
 const [resources, setResources] = useState([]);
 useEffect(() => {
 const savedTheme = localStorage.getItem('theme');
 if (savedTheme) setTheme(savedTheme);
 }, []);
 useEffect(() => {
 localStorage.setItem('theme', theme);
 }, [theme]);
 const handleSearch = async (query) => {
 try {
 const response = await fetch(`http://localhost:5000/api/search?q=${query}`);
 const data = await response.json();
 setResources(data);
 } catch (error) {
 console.error('Error fetching resources:', error);
 }
 };
 return (
 <div className={`App ${theme}`}>
 <ThemeToggle theme={theme} setTheme={setTheme} />
 <SearchBar onSearch={handleSearch} />
 <ResourceList resources={resources} />
 </div>
 );
}
export default App;