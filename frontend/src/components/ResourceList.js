import React from 'react';
import parse from 'html-react-parser';
import './ResourceList.css';
function ResourceList({ resources }) {
 return (
 <div className="resource-list">
 {resources.map((resource, index) => (
 <div key={index} className="resource-item">
 <a
 href={resource.url}
 target="_blank"
 rel="noopener noreferrer"
 className="resource-title"
 >
 {resource.title}
 </a>
 <div className="resource-url">{resource.url}</div>
 <div className="resource-snippet">
 {parse(resource.description)}
 </div>
 </div>
 ))}
 </div>
 );
}
export default ResourceList;