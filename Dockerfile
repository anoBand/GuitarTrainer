# Use a lightweight nginx image as a base
FROM nginx:alpine

# Copy all the static assets from the current directory to the nginx html directory
# This includes index.html, css/, js/, and assets/
COPY . /usr/share/nginx/html

# Expose port 80 to allow traffic to the web server
EXPOSE 80

# The default command for the nginx image is to start the server, so no explicit CMD is needed.