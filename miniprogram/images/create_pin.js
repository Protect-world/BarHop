const fs = require('fs');
const path = require('path');

const pinBase64 = 'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAhUlEQVRYR+2W4Q3CMBBFXw5yK0bBqZgCNgBGn4bKXAFkE5YBGdgBFnYBGjYBDHYBDHYB3BYBJnYBJnYBJjYB5DYBDHYBDHYBHLYBHLYBHBYBxLYBLNYBLNYBxNYBDHYBDHYBDHYB3BYBJnYBJnYBJjYB5DYBDHYBDHYBHLYBHLYBHBYBxLYBLNYBLNYBxNYBDHYBDHYBDHYB3BYBJnYBJl4Bl9wC1wR8L8X4AAAAAElFTkSuQmCC';

const buffer = Buffer.from(pinBase64, 'base64');
fs.writeFileSync(path.join(__dirname, 'pin.png'), buffer);
console.log('Pin icon created successfully');
