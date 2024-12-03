// In-memory storage for tags (in a production environment, this would be a database)
const resourceTags = new Map();
const tagCounts = new Map();

// Function to add a tag to a resource
function addTag(resourceId, tag) {
    // Normalize the tag (lowercase, trim)
    tag = tag.toLowerCase().trim();
    
    // Initialize tags array for the resource if it doesn't exist
    if (!resourceTags.has(resourceId)) {
        resourceTags.set(resourceId, new Set());
    }
    
    // Add tag to resource
    resourceTags.get(resourceId).add(tag);
    
    // Update tag count
    tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    
    return getResourceTags(resourceId);
}

// Function to get tags for a resource
function getResourceTags(resourceId) {
    const tags = Array.from(resourceTags.get(resourceId) || []);
    const popularTags = getPopularTags();
    
    return {
        tags,
        popularTags
    };
}

// Function to get popular tags (tags used more than once)
function getPopularTags() {
    return Array.from(tagCounts.entries())
        .filter(([_, count]) => count > 1)
        .sort((a, b) => b[1] - a[1])
        .map(([tag]) => tag);
}

// Function to remove a tag from a resource
function removeTag(resourceId, tag) {
    tag = tag.toLowerCase().trim();
    
    if (resourceTags.has(resourceId)) {
        const tags = resourceTags.get(resourceId);
        if (tags.has(tag)) {
            tags.delete(tag);
            
            // Update tag count
            const count = tagCounts.get(tag);
            if (count > 1) {
                tagCounts.set(tag, count - 1);
            } else {
                tagCounts.delete(tag);
            }
        }
    }
    
    return getResourceTags(resourceId);
}

module.exports = {
    addTag,
    getResourceTags,
    removeTag
};
