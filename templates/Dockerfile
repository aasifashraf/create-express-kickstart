# Use a package-manager-specific runtime image
FROM __BASE_IMAGE__

WORKDIR /usr/src/app

COPY package.json ./
__PACKAGE_MANAGER_SETUP__
RUN __INSTALL_COMMAND__

COPY . .

EXPOSE __PORT__

CMD [ "__RUNTIME__", "src/server.js" ]
