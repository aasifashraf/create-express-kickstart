# Use official Node.js runtime as a parent image
FROM node:20-alpine

# Set working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and lockfile based on package manager used
COPY package.json ./

# Install project dependencies
RUN npm install --production

# Bundle app source
COPY . .

# Expose port the app runs on
EXPOSE 3000

# Command to run your app
CMD [ "node", "src/server.js" ]
